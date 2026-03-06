'use strict';

const path = require('path');
const fs = require('fs');

const pdfParse = require('pdf-parse'); // ✅ pdf-parse@1.1.1 (function)
const mammoth = require('mammoth');
const xlsx = require('xlsx');
const { parse: parseCsv } = require('csv-parse/sync');
const AdmZip = require('adm-zip');

const { openai } = require('../clients/openai');
const { logUsageEvent } = require('../billing/logger');
const { usdFromTokenPricing, estimateTokens } = require('../billing/cost');

async function extractTextFromFile(buffer, mimetype, originalName, options = {}) {
  const lowerName = (originalName || '').toLowerCase();
  const extMatch = lowerName.match(/\.([a-z0-9]+)$/i);
  const ext = extMatch ? extMatch[1] : '';

  let mime = mimetype || '';
  if (
    !mime ||
    mime === 'application/octet-stream' ||
    mime === 'binary/octet-stream'
  ) {
    // try infer from extension
    if (ext === 'pdf') mime = 'application/pdf';
    else if (ext === 'docx')
      mime =
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
    else if (ext === 'xlsx')
      mime =
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
    else if (ext === 'csv') mime = 'text/csv';
    else if (ext === 'json') mime = 'application/json';
    else if (ext === 'zip') mime = 'application/zip';
    else if (['txt','md','log'].includes(ext)) mime = 'text/plain';
    else if (['png', 'jpg', 'jpeg', 'webp', 'gif'].includes(ext)) {
      const e = ext === 'jpg' ? 'jpeg' : ext;
      mime = `image/${e}`;
    } else if (['mp3', 'wav', 'm4a'].includes(ext)) {
      mime = ext === 'm4a' ? 'audio/mp4' : `audio/${ext}`;
    }
  }

  
// 0) JSON
if (mime === 'application/json' || ext === 'json') {
  try {
    const raw = buffer.toString('utf8');
    // Try pretty-print; if invalid JSON, return raw (trimmed)
    try {
      const obj = JSON.parse(raw);
      const pretty = JSON.stringify(obj, null, 2);
      return pretty.length > 300000 ? pretty.slice(0, 300000) : pretty;
    } catch {
      return raw.length > 300000 ? raw.slice(0, 300000) : raw;
    }
  } catch (err) {
    console.error('❌ [JSON] Parse error for', originalName, ':', err.message);
    return '';
  }
}

// 0b) ZIP (extract text-like files from archive)
if (mime === 'application/zip' || ext === 'zip') {
  try {
    console.log('🗜️ [ZIP] Parsing ZIP file:', originalName, 'size:', buffer.length);
    const zip = new AdmZip(buffer);
    const entries = zip.getEntries() || [];
    // Keep only non-binary, reasonably small text-ish files
    const allowExt = new Set(['txt','md','csv','json','log','xml','yaml','yml','html','htm','js','ts','py','java','c','cpp','cs','go','rs','php','sql']);
    const maxFiles = 30;
    const maxPerFile = 60_000;
    const maxTotal = 300_000;

    let out = '';
    let usedFiles = 0;

    for (const e of entries) {
      if (usedFiles >= maxFiles) break;
      if (e.isDirectory) continue;
      const name = String(e.entryName || '');
      const lower = name.toLowerCase();
      const m = lower.match(/\.([a-z0-9]+)$/i);
      const ext2 = m ? m[1] : '';
      if (!allowExt.has(ext2)) continue;

      const data = e.getData();
      if (!data) continue;

      let text = '';
      try { text = data.toString('utf8'); } catch { continue; }
      if (!text) continue;

      // Skip files that look binary (too many NULs)
      const nulCount = (text.match(/\u0000/g) || []).length;
      if (nulCount > 0) continue;

      text = text.slice(0, maxPerFile);
      const header = `\n--- FILE: ${name} ---\n`;
      if (out.length + header.length + text.length > maxTotal) break;

      out += header + text + '\n';
      usedFiles++;
    }

    console.log('✅ [ZIP] Extracted', out.length, 'chars from', usedFiles, 'files');
    return out;
  } catch (err) {
    console.error('❌ [ZIP] Parse error for', originalName, ':', err.message);
    return '';
  }
}

// 1) PDF  ✅ pdf-parse@1.1.1 API
  if (mime === 'application/pdf' || ext === 'pdf') {
    try {
      console.log(
        '📄 [PDF] Parsing PDF file:',
        originalName,
        'size:',
        buffer.length
      );

      // pdf-parse@1.1.1 is a function: pdfParse(buffer) -> { text, numpages, ... }
      if (typeof pdfParse !== 'function') {
        throw new Error(
          `pdf-parse is not a function (installed version/API mismatch). Got: ${typeof pdfParse}`
        );
      }

      const parsed = await pdfParse(buffer);
      const text = parsed.text || '';

      console.log(
        '✅ [PDF v1.1.1] Extracted',
        text.length,
        'chars from',
        parsed.numpages,
        'pages'
      );

      return text;
    } catch (err) {
      console.error('❌ [PDF] Parse error for', originalName, ':', err.message);
      console.error('   Stack:', err.stack);
      throw new Error(`PDF parsing failed: ${err.message}`);
    }
  }

  // 2) DOCX
  if (
    mime ===
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
    ext === 'docx'
  ) {
    try {
      console.log(
        '📝 [DOCX] Parsing DOCX file:',
        originalName,
        'size:',
        buffer.length
      );
      const result = await mammoth.extractRawText({ buffer });
      const text = result.value || '';
      console.log('✅ [DOCX] Extracted', text.length, 'chars');
      if (result.messages && result.messages.length > 0) {
        console.warn('⚠️ [DOCX] Warnings:', result.messages);
      }
      return text;
    } catch (err) {
      console.error('❌ [DOCX] Parse error for', originalName, ':', err.message);
      console.error('   Stack:', err.stack);
      throw new Error(`DOCX parsing failed: ${err.message}`);
    }
  }

  // 3) XLSX / XLS (V4.3: Enhanced parsing)
  if (
    mime === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' ||
    mime === 'application/vnd.ms-excel' ||
    ext === 'xlsx' ||
    ext === 'xls'
  ) {
    try {
      console.log(`📊 [EXCEL] Parsing Excel file (${ext}):`, originalName, 'size:', buffer.length);
      
      // V4.3: Support both .xlsx and old .xls format
      const wb = xlsx.read(buffer, { type: 'buffer', cellDates: true });
      let out = '';
      let totalRows = 0;
      
      wb.SheetNames.forEach((sheetName, sheetIdx) => {
        const ws = wb.Sheets[sheetName];
        if (!ws || !ws['!ref']) {
          console.log(`⚠️ [EXCEL] Sheet "${sheetName}" is empty, skipping`);
          return;
        }
        
        // Get sheet range
        const range = xlsx.utils.decode_range(ws['!ref']);
        const numRows = range.e.r - range.s.r + 1;
        const numCols = range.e.c - range.s.c + 1;
        
        console.log(`📄 [EXCEL] Sheet "${sheetName}": ${numRows} rows × ${numCols} cols`);
        
        // Extract headers (first row)
        const headers = [];
        for (let C = range.s.c; C <= range.e.c; ++C) {
          const cellAddr = xlsx.utils.encode_cell({ r: range.s.r, c: C });
          const cell = ws[cellAddr];
          headers.push(cell ? String(cell.v || '').trim() : `Col${C + 1}`);
        }
        
        // Convert to CSV (skipping empty rows)
        const csvData = xlsx.utils.sheet_to_csv(ws, { 
          blankrows: false,  // Skip blank rows
          strip: true        // Strip whitespace
        });
        
        // V4.3: Clean output - filter binary garbage lines
        const lines = csvData.split('\n').filter(line => {
          if (!line.trim()) return false;
          // Skip lines with too many non-printable characters
          const printableChars = (line.match(/[\x20-\x7E]/g) || []).length;
          const ratio = printableChars / line.length;
          return ratio > 0.7;  // Keep if >70% printable
        });
        
        if (lines.length === 0) {
          console.log(`⚠️ [EXCEL] No valid data in sheet "${sheetName}"`);
          return;
        }
        
        // Build clean output
        out += `\n========================================\n`;
        out += `SHEET: ${sheetName} (${sheetIdx + 1}/${wb.SheetNames.length})\n`;
        out += `COLUMNS: ${headers.join(' | ')}\n`;
        out += `ROWS: ${lines.length}\n`;
        out += `========================================\n\n`;
        out += lines.join('\n') + '\n';
        
        totalRows += lines.length;
      });
      
      console.log(`✅ [EXCEL] Extracted ${out.length} chars from ${totalRows} rows across ${wb.SheetNames.length} sheet(s)`);
      
      if (out.length < 10) {
        console.warn('⚠️ [EXCEL] Very little data extracted, file might be corrupted or empty');
      }
      
      return out;
    } catch (err) {
      console.error('❌ [EXCEL] Parse error:', err.message);
      console.error('   Stack:', err.stack);
      return '';
    }
  }

  // 5) CSV
  if (mime === 'text/csv' || ext === 'csv') {
    const text = buffer.toString('utf8');
    const records = parseCsv(text, { columns: false, skip_empty_lines: true });
    let out = '';
    for (const row of records) {
      out += row.join(', ') + '\n';
    }
    return out;
  }

  // 6) Image -> Vision (OCR/description)
  if (
    (mime || '').startsWith('image/') ||
    ['png', 'jpg', 'jpeg', 'webp', 'gif'].includes(ext)
  ) {
    // We can still try Google Cloud Vision OCR even if OpenAI is unavailable.
    const hasOpenAI = Boolean(openai);

    let visionMime = mime;
    if (!visionMime || !visionMime.startsWith('image/')) {
      if (ext === 'jpg') visionMime = 'image/jpeg';
      else if (ext === 'jpeg') visionMime = 'image/jpeg';
      else if (ext === 'png') visionMime = 'image/png';
      else if (ext === 'webp') visionMime = 'image/webp';
      else if (ext === 'gif') visionMime = 'image/gif';
      else visionMime = 'image/jpeg';
    }

    console.log(
      '🖼️ [IMAGE] Processing image:',
      originalName,
      'mime:',
      visionMime,
      'size:',
      buffer.length
    );

    // Strict guard: only run OCR/Vision when the user asked for reading a picture
    // (or when the query strongly implies flyer/price list/menu OCR).
    // This prevents accidental spend + hallucinations.
    try {
      const visionMode = String(options?.visionMode || options?.vision || 'auto').toLowerCase();
      const strictGuard = options?.strictVisionGuard !== false;
      const userText = String(options?.userText || '');
      const forced = Boolean(options?.forceVision || options?.userRequestedVision);

      const wantsRead = /(\bocr\b|pročitaj|procitaj|čitaj|citaj|što\s+piše|sto\s+pise|s\s+slike|iz\s+slike|read\s+.*image|extract\s+.*text|text\s+from\s+image)/i.test(userText);
      const flyerIntent = /(flyer|letak|katalog|cjenik|cjenovnik|cijene|price\s+list|menu|jelovnik|ponuda|akcija)/i.test(userText);

      const allow =
        visionMode === 'on' || visionMode === 'true' || visionMode === '1'
          ? (strictGuard ? (forced || wantsRead || flyerIntent) : true)
          : (visionMode !== 'off' && visionMode !== 'false' && visionMode !== '0' && (forced || wantsRead || flyerIntent));

      if (!allow && strictGuard) {
        return `IMAGE_OCR_SKIPPED: OCR/Vision nije pokrenut jer korisnik nije tražio čitanje slike.\nFILE: ${originalName}\nHINT: Ako želiš OCR, napiši npr. "pročitaj što piše na slici".`;
      }
    } catch (_) {
      // If guard fails, fall back to previous behaviour (do not block extraction).
    }

    let ocrText = '';
    let visionDescription = '';

    // Step 1: Google Cloud Vision OCR (if available)
    try {
      const vision = require('@google-cloud/vision');
      const visionClient = new vision.ImageAnnotatorClient();

      console.log('📝 [OCR] Running Google Cloud Vision OCR...');
      const [result] = await visionClient.textDetection({
        image: { content: buffer },
      });
      const detections = result.textAnnotations;

      if (detections && detections.length > 0) {
        ocrText = detections[0].description || '';
        console.log(`✅ [OCR] Extracted ${ocrText.length} chars from image`);
      } else {
        console.log('ℹ️ [OCR] No text detected in image');
      }
    } catch (ocrErr) {
      console.warn(
        '⚠️ [OCR] Google Vision OCR failed (continuing with OpenAI only):',
        ocrErr.message
      );
      // Continue without OCR
    }

    // Step 2: OpenAI Vision for image description
    try {
      const base64 = buffer.toString('base64');
      console.log('🤖 [IMAGE] Calling OpenAI Vision API for description...');

      const resp = await openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'user',
            content: [
              {
                type: 'text',
                text: 'Describe what you see in this image (objects, scene, layout, etc.). Be concise.',
              },
              {
                type: 'image_url',
                image_url: {
                  url: `data:${visionMime};base64,${base64}`,
                },
              },
            ],
          },
        ],
      });

      // Billing (OpenAI file_extract_vision)
      try {
        const modelUsed = 'gpt-4o-mini';
        const u = (resp && resp.usage) ? resp.usage : {};
        const promptTokens = Number(u.prompt_tokens || 0) || estimateTokens('file_extract');
        const completionTokens = Number(u.completion_tokens || 0) || 0;
        const cost = usdFromTokenPricing({ provider: 'openai', model: modelUsed, promptTokens, completionTokens, kind: 'vision' });

        const b = (options && typeof options === 'object') ? (options.billing || {}) : {};
        await logUsageEvent({
          ts: new Date(),
          userId: b.userId || null,
          conversationId: b.conversationId || null,
          requestId: b.requestId || null,
          kind: 'vision',
          provider: 'openai',
          model: modelUsed,
          operation: 'file_extract_vision',
          units: { promptTokens, completionTokens, totalTokens: Number(u.total_tokens || (promptTokens + completionTokens)) || (promptTokens + completionTokens) },
          costUsd: cost.usd || 0,
          meta: { breakdown: cost.breakdown || {}, httpStatus: 200 },
        });
      } catch (_) {
        // ignore billing failures
      }


      visionDescription = resp.choices[0]?.message?.content || '';
      console.log(
        '✅ [IMAGE] Vision description:',
        visionDescription.length,
        'chars'
      );
    } catch (err) {
      console.error(
        '❌ [IMAGE] Vision API error for',
        originalName,
        ':',
        err.message
      );
      console.error('   Stack:', err.stack);
      // Don't fail the whole request if vision fails — keep OCR if we have it.
      visionDescription = '';
      console.warn('⚠️ [IMAGE] Vision description unavailable, continuing.');
    }

    // Step 3: Combine OCR + Vision description
    let combinedText = '';

    if (ocrText && ocrText.length > 10) {
      combinedText += `📝 TEXT EXTRACTED FROM IMAGE (OCR):\n${ocrText}\n\n`;
    }

    if (visionDescription) {
      combinedText += `🖼️ IMAGE DESCRIPTION:\n${visionDescription}`;
    }

    if (!combinedText) {
      combinedText =
        visionDescription || 'Image processed but no text or description extracted.';
    }

    console.log(
      `✅ [IMAGE] Final combined text: ${combinedText.length} chars`
    );
    if (!combinedText.trim()) {
      combinedText =
        '🖼️ IMAGE RECEIVED\n' +
        '(Nisam uspio izvući tekst (OCR) niti napraviti opis slike. ' +
        'Ako želiš, pošalji veću/čistiju sliku ili uključi Google Vision API/OpenAI Vision.)\n';
    }

    return combinedText;
  }

  // 7) Audio -> transcription
  if (
    (mime || '').startsWith('audio/') ||
    ['mp3', 'wav', 'm4a'].includes(ext)
  ) {
    if (!openai) {
      console.log('🎧 Audio transcription disabled — no OpenAI SDK');
      return '';
    }

    const safeExt = ['mp3', 'wav', 'm4a'].includes(ext) ? ext : 'mp3';
    const tmpPath = path.join(
      '/tmp',
      `rag-audio-${Date.now()}-${Math.random().toString(36).slice(2)}.${safeExt}`
    );

    await fs.promises.writeFile(tmpPath, buffer);

    try {
      const audioStream = fs.createReadStream(tmpPath);
      const transcript = await openai.audio.transcriptions.create({
        file: audioStream,
        model: 'gpt-4o-transcribe',
        response_format: 'text',
      });

      if (typeof transcript === 'string') return transcript;
      if (transcript && typeof transcript.text === 'string')
        return transcript.text;
      return JSON.stringify(transcript);
    } catch (err) {
      console.error('❌ Audio transcription error:', err);
      return '';
    } finally {
      fs.promises.unlink(tmpPath).catch(() => {});
    }
  }

  // 8) Fallback
  const asText = buffer.toString('utf8');
  return asText.length > 200000 ? asText.slice(0, 200000) : asText;
}

module.exports = { extractTextFromFile };
