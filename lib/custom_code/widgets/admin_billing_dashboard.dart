// Automatic FlutterFlow imports
import '/backend/backend.dart';
import '/backend/schema/structs/index.dart';
import '/flutter_flow/flutter_flow_theme.dart';
import '/flutter_flow/flutter_flow_util.dart';
import 'index.dart'; // Imports other custom widgets
import '/custom_code/actions/index.dart'; // Imports custom actions
import '/flutter_flow/custom_functions.dart'; // Imports custom functions
import 'package:flutter/material.dart';
// Begin custom widget code
// DO NOT REMOVE OR MODIFY THE CODE ABOVE!

import 'dart:math' as math;
import 'dart:ui' as ui;
import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:intl/intl.dart';
import 'package:provider/provider.dart';

class AdminBillingDashboard extends StatefulWidget {
  const AdminBillingDashboard({
    super.key,
    this.width,
    this.height,
    this.userId,
  });

  final double? width;
  final double? height;
  final String? userId;

  @override
  State<AdminBillingDashboard> createState() => _AdminBillingDashboardState();
}

class _AdminBillingDashboardState extends State<AdminBillingDashboard>
    with TickerProviderStateMixin {
  late final TabController _tab;
  int _rangeDays = 30; // 7 / 30 / 90 / 365
  bool _showUsd = true;
  bool _chartShowProfit = true;

  @override
  void initState() {
    super.initState();
    _tab = TabController(length: 3, vsync: this);
  }

  @override
  void dispose() {
    _tab.dispose();
    super.dispose();
  }

  // --- Helperi ---

  String _ymdUtc(DateTime dt) {
    final u = dt.toUtc();
    return '${u.year}-${u.month.toString().padLeft(2, '0')}-${u.day.toString().padLeft(2, '0')}';
  }

  String _ymUtc(DateTime dt) {
    final u = dt.toUtc();
    return '${u.year}-${u.month.toString().padLeft(2, '0')}';
  }

  DateTime _parseYmd(String ymd) {
    final m = RegExp(r'^(\d{4})-(\d{2})-(\d{2})$').firstMatch(ymd);
    if (m == null) return DateTime.now().toUtc();
    return DateTime.utc(
      int.parse(m.group(1)!),
      int.parse(m.group(2)!),
      int.parse(m.group(3)!),
    );
  }

  double _num(dynamic v) {
    if (v == null) return 0;
    if (v is num) return v.toDouble();
    return double.tryParse(v.toString()) ?? 0;
  }

  int _int(dynamic v) {
    if (v == null) return 0;
    if (v is int) return v;
    if (v is num) return v.toInt();
    return int.tryParse(v.toString()) ?? 0;
  }

  String _money(double v) {
    if (_showUsd) {
      return NumberFormat.currency(symbol: '\$', decimalDigits: 2).format(v);
    }
    return NumberFormat.decimalPattern().format(v);
  }

  String _pct(double v) => NumberFormat("##0.0%").format(v);

  // Generira boju na temelju stringa (za avatare)
  Color _stringColor(String str, bool isDark) {
    final hash = str.hashCode;
    final r = (hash & 0xFF0000) >> 16;
    final g = (hash & 0x00FF00) >> 8;
    final b = (hash & 0x0000FF);
    final color = Color.fromARGB(255, r, g, b);
    // Prilagodi svjetlinu da se vidi tekst
    final hsl = HSLColor.fromColor(color);
    return hsl
        .withLightness(isDark ? 0.65 : 0.45)
        .withSaturation(0.7)
        .toColor();
  }

  // --- Streams ---

  Stream<QuerySnapshot<Map<String, dynamic>>> _dailyStream(int days) {
    final now = DateTime.now().toUtc();
    final end = _ymdUtc(now);
    final start = _ymdUtc(now.subtract(Duration(days: days - 1)));

    return FirebaseFirestore.instance
        .collection('billing_daily')
        .where(FieldPath.documentId, isGreaterThanOrEqualTo: start)
        .where(FieldPath.documentId, isLessThanOrEqualTo: end)
        .orderBy(FieldPath.documentId)
        .snapshots();
  }

  Stream<QuerySnapshot<Map<String, dynamic>>> _integrationsStream(int days) {
    final now = DateTime.now().toUtc();
    final end = _ymdUtc(now);
    final start = _ymdUtc(now.subtract(Duration(days: days - 1)));

    return FirebaseFirestore.instance
        .collection('billing_daily_integrations')
        .where('day', isGreaterThanOrEqualTo: start)
        .where('day', isLessThanOrEqualTo: end)
        .snapshots();
  }

  Stream<QuerySnapshot<Map<String, dynamic>>> _usersStream(int days) {
    final now = DateTime.now().toUtc();
    final end = _ymdUtc(now);
    final start = _ymdUtc(now.subtract(Duration(days: days - 1)));

    return FirebaseFirestore.instance
        .collection('billing_daily_users')
        .where('day', isGreaterThanOrEqualTo: start)
        .where('day', isLessThanOrEqualTo: end)
        .snapshots();
  }

  _DayRow _dayFromDoc(QueryDocumentSnapshot<Map<String, dynamic>> doc) {
    final data = doc.data();
    final cost = _num(data['costUsd']);
    final infra = _num(data['infraUsd']);
    final revenue = _num(data['revenueUsd']);
    final count = _int(data['count']);
    final totalCost = cost + infra;
    final profit = revenue - totalCost;
    final margin = revenue > 0 ? (profit / revenue) : null;

    return _DayRow(
      day: doc.id,
      costUsd: cost,
      infraUsd: infra,
      revenueUsd: revenue,
      count: count,
      profitUsd: profit,
      margin: margin,
    );
  }

  // --- Build ---

  @override
  Widget build(BuildContext context) {
    context.watch<FFAppState>();
    final isDark = Theme.of(context).brightness == Brightness.dark;

    // Boje teme
    final bg = isDark ? const Color(0xFF0F0F0F) : const Color(0xFFF7F7FA);

    return Container(
      width: widget.width ?? double.infinity,
      height: widget.height ?? double.infinity,
      color: bg,
      child: SafeArea(
        child: Column(
          children: [
            _buildTopBar(isDark),
            const SizedBox(height: 10),
            _buildRangeBar(isDark),
            const SizedBox(height: 10),
            _buildTabBar(isDark),
            Expanded(
              child: TabBarView(
                controller: _tab,
                children: [
                  _buildOverviewTab(isDark),
                  _buildIntegrationsTab(isDark),
                  _buildUsersTab(isDark),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildTopBar(bool isDark) {
    final text = isDark ? Colors.white : const Color(0xFF141414);
    final sub = isDark ? const Color(0xFF9A9A9A) : const Color(0xFF6B6B6B);

    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 12),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          Row(
            children: [
              Container(
                width: 40,
                height: 40,
                decoration: BoxDecoration(
                  gradient: const LinearGradient(
                    colors: [Color(0xFF4F46E5), Color(0xFF9333EA)],
                    begin: Alignment.topLeft,
                    end: Alignment.bottomRight,
                  ),
                  borderRadius: BorderRadius.circular(12),
                  boxShadow: [
                    BoxShadow(
                      color: const Color(0xFF4F46E5).withOpacity(0.3),
                      blurRadius: 8,
                      offset: const Offset(0, 4),
                    ),
                  ],
                ),
                child: const Icon(Icons.bar_chart_rounded,
                    color: Colors.white, size: 22),
              ),
              const SizedBox(width: 12),
              Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    'Billing Dashboard',
                    style: GoogleFonts.inter(
                      fontSize: 18,
                      fontWeight: FontWeight.w700,
                      color: text,
                    ),
                  ),
                  Text(
                    'Analitika i troškovi',
                    style: GoogleFonts.inter(
                      fontSize: 12,
                      fontWeight: FontWeight.w500,
                      color: sub,
                    ),
                  ),
                ],
              ),
            ],
          ),
          InkWell(
            onTap: () => setState(() => _showUsd = !_showUsd),
            borderRadius: BorderRadius.circular(30),
            child: Container(
              padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 8),
              decoration: BoxDecoration(
                color: isDark ? const Color(0xFF1E1E1E) : Colors.white,
                borderRadius: BorderRadius.circular(30),
                border: Border.all(
                  color: isDark
                      ? const Color(0xFF333333)
                      : const Color(0xFFE5E5E5),
                ),
              ),
              child: Row(
                children: [
                  Text(
                    _showUsd ? 'USD' : 'RAW',
                    style: GoogleFonts.inter(
                      fontSize: 12,
                      fontWeight: FontWeight.w600,
                      color: text,
                    ),
                  ),
                  const SizedBox(width: 6),
                  Icon(Icons.swap_horiz_rounded, size: 16, color: sub),
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildRangeBar(bool isDark) {
    Widget chip(int days, String label) {
      final active = _rangeDays == days;
      return GestureDetector(
        onTap: () => setState(() => _rangeDays = days),
        child: AnimatedContainer(
          duration: const Duration(milliseconds: 200),
          padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
          decoration: BoxDecoration(
            color: active
                ? (isDark ? Colors.white : const Color(0xFF141414))
                : Colors.transparent,
            borderRadius: BorderRadius.circular(30),
            border: Border.all(
              color: active
                  ? Colors.transparent
                  : (isDark
                      ? const Color(0xFF333333)
                      : const Color(0xFFE0E0E0)),
            ),
          ),
          child: Text(
            label,
            style: GoogleFonts.inter(
              fontSize: 12,
              fontWeight: FontWeight.w600,
              color: active
                  ? (isDark ? Colors.black : Colors.white)
                  : (isDark
                      ? const Color(0xFFAAAAAA)
                      : const Color(0xFF666666)),
            ),
          ),
        ),
      );
    }

    return SingleChildScrollView(
      scrollDirection: Axis.horizontal,
      padding: const EdgeInsets.symmetric(horizontal: 20),
      child: Row(
        children: [
          chip(7, '7D'),
          const SizedBox(width: 8),
          chip(30, '30D'),
          const SizedBox(width: 8),
          chip(90, '3M'),
          const SizedBox(width: 8),
          chip(365, '1Y'),
          const SizedBox(width: 12),
          Container(
              width: 1,
              height: 24,
              color:
                  isDark ? const Color(0xFF333333) : const Color(0xFFE0E0E0)),
          const SizedBox(width: 12),
          InkWell(
            onTap: () => setState(() => _chartShowProfit = !_chartShowProfit),
            borderRadius: BorderRadius.circular(30),
            child: Row(
              children: [
                Icon(
                  _chartShowProfit
                      ? Icons.show_chart_rounded
                      : Icons.money_off_rounded,
                  size: 18,
                  color: isDark
                      ? const Color(0xFFAAAAAA)
                      : const Color(0xFF666666),
                ),
                const SizedBox(width: 6),
                Text(
                  _chartShowProfit ? 'Profit' : 'Trošak',
                  style: GoogleFonts.inter(
                    fontSize: 12,
                    fontWeight: FontWeight.w600,
                    color: isDark
                        ? const Color(0xFFAAAAAA)
                        : const Color(0xFF666666),
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildTabBar(bool isDark) {
    return Container(
      height: 44,
      margin: const EdgeInsets.symmetric(horizontal: 20),
      decoration: BoxDecoration(
        color: isDark ? const Color(0xFF1E1E1E) : Colors.white,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(
          color: isDark ? const Color(0xFF333333) : const Color(0xFFE5E5E5),
        ),
      ),
      child: TabBar(
        controller: _tab,
        indicatorSize: TabBarIndicatorSize.tab,
        indicatorPadding: const EdgeInsets.all(4),
        indicator: BoxDecoration(
          borderRadius: BorderRadius.circular(8),
          color: isDark ? const Color(0xFF333333) : const Color(0xFFF3F4F6),
        ),
        dividerColor: Colors.transparent,
        labelColor: isDark ? Colors.white : Colors.black,
        unselectedLabelColor:
            isDark ? const Color(0xFF888888) : const Color(0xFF888888),
        labelStyle:
            GoogleFonts.inter(fontWeight: FontWeight.w600, fontSize: 13),
        tabs: const [
          Tab(text: 'Pregled'),
          Tab(text: 'Integracije'),
          Tab(text: 'Korisnici'),
        ],
      ),
    );
  }

  Widget _buildOverviewTab(bool isDark) {
    return StreamBuilder<QuerySnapshot<Map<String, dynamic>>>(
      stream: _dailyStream(_rangeDays),
      builder: (context, snap) {
        if (snap.connectionState == ConnectionState.waiting) {
          return _loadingView(isDark);
        }
        if (!snap.hasData || snap.data!.docs.isEmpty) {
          return _emptyView(isDark, 'Nema podataka za odabrani period.');
        }

        final rows = snap.data!.docs.map(_dayFromDoc).toList();

        // Sumiranje
        double cost = 0, infra = 0, revenue = 0, profit = 0;
        int count = 0;
        for (final r in rows) {
          cost += r.costUsd;
          infra += r.infraUsd;
          revenue += r.revenueUsd;
          profit += r.profitUsd;
          count += r.count;
        }

        final series = rows
            .map((r) =>
                _chartShowProfit ? r.profitUsd : (r.costUsd + r.infraUsd))
            .toList();

        return ListView(
          padding: const EdgeInsets.fromLTRB(20, 10, 20, 30),
          children: [
            _buildHeroCards(isDark, revenue, profit, count, cost + infra),
            const SizedBox(height: 20),
            _buildChartSection(isDark, rows, series),
            const SizedBox(height: 20),
            _buildSectionTitle(isDark, 'Nedavna aktivnost'),
            const SizedBox(height: 10),
            ...rows.reversed.take(7).map((r) => _buildDayTile(isDark, r)),
            const SizedBox(height: 20),
            _buildInfoBox(isDark),
          ],
        );
      },
    );
  }

  Widget _buildHeroCards(
      bool isDark, double rev, double prof, int calls, double cost) {
    return Column(
      children: [
        Row(
          children: [
            Expanded(
              child: _statCard(
                isDark,
                'Profit',
                _money(prof),
                icon: Icons.trending_up,
                iconColor: prof >= 0
                    ? const Color(0xFF34C759)
                    : const Color(0xFFFF3B30),
                trend: prof >= 0 ? '+Net' : '-Loss',
                isPrimary: true,
              ),
            ),
            const SizedBox(width: 12),
            Expanded(
              child: _statCard(
                isDark,
                'Revenue',
                _money(rev),
                icon: Icons.attach_money,
                iconColor: Colors.blueAccent,
              ),
            ),
          ],
        ),
        const SizedBox(height: 12),
        Row(
          children: [
            Expanded(
              child: _statCard(
                isDark,
                'Troškovi',
                _money(cost),
                icon: Icons.outbox,
                iconColor: Colors.orangeAccent,
              ),
            ),
            const SizedBox(width: 12),
            Expanded(
              child: _statCard(
                isDark,
                'Pozivi',
                NumberFormat.compact().format(calls),
                icon: Icons.api,
                iconColor: Colors.purpleAccent,
              ),
            ),
          ],
        ),
      ],
    );
  }

  Widget _statCard(
    bool isDark,
    String title,
    String value, {
    required IconData icon,
    required Color iconColor,
    String? trend,
    bool isPrimary = false,
  }) {
    final bg = isDark ? const Color(0xFF1E1E1E) : Colors.white;
    final border = isDark ? const Color(0xFF333333) : const Color(0xFFE5E5E5);

    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: bg,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: border),
        boxShadow: isPrimary
            ? [
                BoxShadow(
                  color: iconColor.withOpacity(0.15),
                  blurRadius: 12,
                  offset: const Offset(0, 4),
                )
              ]
            : null,
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Container(
                padding: const EdgeInsets.all(6),
                decoration: BoxDecoration(
                  color: iconColor.withOpacity(0.1),
                  borderRadius: BorderRadius.circular(8),
                ),
                child: Icon(icon, size: 18, color: iconColor),
              ),
              if (trend != null)
                Container(
                  padding:
                      const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                  decoration: BoxDecoration(
                    color: iconColor.withOpacity(0.1),
                    borderRadius: BorderRadius.circular(4),
                  ),
                  child: Text(
                    trend,
                    style: GoogleFonts.inter(
                      fontSize: 10,
                      fontWeight: FontWeight.bold,
                      color: iconColor,
                    ),
                  ),
                ),
            ],
          ),
          const SizedBox(height: 12),
          Text(
            value,
            style: GoogleFonts.inter(
              fontSize: 20,
              fontWeight: FontWeight.w700,
              color: isDark ? Colors.white : const Color(0xFF111111),
            ),
          ),
          const SizedBox(height: 2),
          Text(
            title,
            style: GoogleFonts.inter(
              fontSize: 12,
              fontWeight: FontWeight.w500,
              color: isDark ? const Color(0xFF888888) : const Color(0xFF666666),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildChartSection(
      bool isDark, List<_DayRow> rows, List<double> values) {
    final bg = isDark ? const Color(0xFF1E1E1E) : Colors.white;
    final border = isDark ? const Color(0xFF333333) : const Color(0xFFE5E5E5);
    final lastVal = values.isNotEmpty ? values.last : 0.0;
    final color = _chartShowProfit
        ? (lastVal >= 0 ? const Color(0xFF34C759) : const Color(0xFFFF3B30))
        : const Color(0xFF4F46E5);

    return Container(
      padding: const EdgeInsets.all(20),
      decoration: BoxDecoration(
        color: bg,
        borderRadius: BorderRadius.circular(20),
        border: Border.all(color: border),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    _chartShowProfit ? 'Trend Profita' : 'Trend Troškova',
                    style: GoogleFonts.inter(
                      fontSize: 14,
                      fontWeight: FontWeight.w600,
                      color: isDark ? Colors.white70 : Colors.black54,
                    ),
                  ),
                  const SizedBox(height: 4),
                  Text(
                    _money(lastVal),
                    style: GoogleFonts.inter(
                      fontSize: 24,
                      fontWeight: FontWeight.w800,
                      color: isDark ? Colors.white : Colors.black,
                    ),
                  ),
                ],
              ),
              Container(
                padding:
                    const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                decoration: BoxDecoration(
                  color: color.withOpacity(0.1),
                  borderRadius: BorderRadius.circular(8),
                ),
                child: Text(
                  'Zadnji dan',
                  style: GoogleFonts.inter(
                    fontSize: 11,
                    fontWeight: FontWeight.w600,
                    color: color,
                  ),
                ),
              ),
            ],
          ),
          const SizedBox(height: 24),
          SizedBox(
            height: 160,
            width: double.infinity,
            child: CustomPaint(
              painter: _PremiumChartPainter(
                values: values,
                lineColor: color,
                isDark: isDark,
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildDayTile(bool isDark, _DayRow r) {
    final dt = _parseYmd(r.day);
    final dateStr = DateFormat('dd. MMM').format(dt.toLocal());
    final profit = r.profitUsd;
    final isPos = profit >= 0;

    return Container(
      margin: const EdgeInsets.only(bottom: 8),
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
      decoration: BoxDecoration(
        color: isDark ? const Color(0xFF1E1E1E) : Colors.white,
        borderRadius: BorderRadius.circular(14),
        border: Border.all(
          color: isDark ? const Color(0xFF333333) : const Color(0xFFF0F0F0),
        ),
      ),
      child: Row(
        children: [
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
            decoration: BoxDecoration(
              color:
                  (isDark ? const Color(0xFF333333) : const Color(0xFFF3F4F6)),
              borderRadius: BorderRadius.circular(8),
            ),
            child: Text(
              dateStr,
              style: GoogleFonts.inter(
                fontSize: 12,
                fontWeight: FontWeight.w600,
                color: isDark ? Colors.white70 : Colors.black87,
              ),
            ),
          ),
          const SizedBox(width: 16),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  '${r.count} poziva',
                  style: GoogleFonts.inter(
                    fontSize: 13,
                    fontWeight: FontWeight.w500,
                    color: isDark ? Colors.white : Colors.black,
                  ),
                ),
                Text(
                  'Cost: ${_money(r.costUsd + r.infraUsd)}',
                  style: GoogleFonts.inter(
                    fontSize: 11,
                    color: isDark ? Colors.white38 : Colors.black45,
                  ),
                ),
              ],
            ),
          ),
          Text(
            _money(profit),
            style: GoogleFonts.inter(
              fontSize: 14,
              fontWeight: FontWeight.w700,
              color: isPos ? const Color(0xFF34C759) : const Color(0xFFFF3B30),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildIntegrationsTab(bool isDark) {
    return StreamBuilder<QuerySnapshot<Map<String, dynamic>>>(
      stream: _integrationsStream(_rangeDays),
      builder: (context, snap) {
        if (snap.connectionState == ConnectionState.waiting)
          return _loadingView(isDark);
        if (!snap.hasData || snap.data!.docs.isEmpty) {
          return _emptyView(isDark, 'Nema podataka o integracijama.');
        }

        final docs = snap.data!.docs;
        final map = <String, _IntegrationAgg>{};

        for (final d in docs) {
          final data = d.data();
          final key = (data['key'] ?? d.id).toString();
          final cur = map[key] ??
              _IntegrationAgg(
                key: key,
                kind: (data['kind'] ?? '').toString(),
                provider: (data['provider'] ?? '').toString(),
                model: (data['model'] ?? '').toString(),
              );
          cur.costUsd += _num(data['costUsd']);
          cur.count += _int(data['count']);
          map[key] = cur;
        }

        final list = map.values.toList()
          ..sort((a, b) => b.costUsd.compareTo(a.costUsd));
        final totalCost = list.fold<double>(0, (p, e) => p + e.costUsd);

        return ListView(
          padding: const EdgeInsets.all(20),
          children: [
            _buildSectionTitle(isDark, 'Potrošnja po modelu'),
            const SizedBox(height: 12),
            ...list
                .take(50)
                .map((it) => _integrationTile(isDark, it, totalCost)),
          ],
        );
      },
    );
  }

  Widget _integrationTile(bool isDark, _IntegrationAgg it, double totalCost) {
    final percent = totalCost > 0 ? (it.costUsd / totalCost) : 0.0;

    return Container(
      margin: const EdgeInsets.only(bottom: 12),
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: isDark ? const Color(0xFF1E1E1E) : Colors.white,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(
          color: isDark ? const Color(0xFF333333) : const Color(0xFFF0F0F0),
        ),
      ),
      child: Column(
        children: [
          Row(
            children: [
              Container(
                padding: const EdgeInsets.all(8),
                decoration: BoxDecoration(
                  color: isDark
                      ? const Color(0xFF333333)
                      : const Color(0xFFF3F4F6),
                  borderRadius: BorderRadius.circular(10),
                ),
                child: Icon(_kindIcon(it.kind),
                    size: 20, color: isDark ? Colors.white70 : Colors.black87),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      it.prettyTitle,
                      style: GoogleFonts.inter(
                        fontWeight: FontWeight.w600,
                        fontSize: 14,
                        color: isDark ? Colors.white : Colors.black87,
                      ),
                    ),
                    Text(
                      '${it.count} requests',
                      style: GoogleFonts.inter(
                          fontSize: 12,
                          color: isDark ? Colors.white38 : Colors.black45),
                    ),
                  ],
                ),
              ),
              Text(
                _money(it.costUsd),
                style: GoogleFonts.inter(
                  fontWeight: FontWeight.bold,
                  fontSize: 14,
                  color: isDark ? Colors.white : Colors.black87,
                ),
              ),
            ],
          ),
          const SizedBox(height: 12),
          // Progress bar
          ClipRRect(
            borderRadius: BorderRadius.circular(4),
            child: LinearProgressIndicator(
              value: percent,
              minHeight: 6,
              backgroundColor:
                  isDark ? const Color(0xFF333333) : const Color(0xFFF3F4F6),
              valueColor: AlwaysStoppedAnimation<Color>(
                  // Gradient boja ovisno o postotku
                  percent > 0.5
                      ? const Color(0xFF9333EA)
                      : const Color(0xFF4F46E5)),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildUsersTab(bool isDark) {
    return StreamBuilder<QuerySnapshot<Map<String, dynamic>>>(
      stream: _usersStream(_rangeDays),
      builder: (context, snap) {
        if (snap.connectionState == ConnectionState.waiting)
          return _loadingView(isDark);
        if (!snap.hasData || snap.data!.docs.isEmpty)
          return _emptyView(isDark, 'Nema podataka o korisnicima.');

        final docs = snap.data!.docs;
        final map = <String, _UserAgg>{};

        for (final d in docs) {
          final data = d.data();
          final uid = (data['userId'] ?? 'unknown').toString();
          final cur = map[uid] ?? _UserAgg(uid);
          cur.costUsd += _num(data['costUsd']);
          cur.revenueUsd += _num(data['revenueUsd']);
          cur.count += _int(data['count']);
          map[uid] = cur;
        }

        final list = map.values.toList()
          ..sort((a, b) => b.costUsd.compareTo(a.costUsd));

        return ListView(
          padding: const EdgeInsets.all(20),
          children: [
            _buildSectionTitle(isDark, 'Top Potrošači'),
            const SizedBox(height: 12),
            ...list.take(50).map((u) => _userTile(isDark, u)),
          ],
        );
      },
    );
  }

  Widget _userTile(bool isDark, _UserAgg u) {
    final profit = u.revenueUsd - u.costUsd;
    final avatarColor = _stringColor(u.userId, isDark);

    return InkWell(
      onTap: () {
        // Placeholder za navigaciju na user profile
        print('Navigiraj na user: ${u.userId}');
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
              content: Text('User ID: ${u.userId} kopiran!'),
              duration: const Duration(seconds: 1)),
        );
      },
      borderRadius: BorderRadius.circular(16),
      child: Container(
        margin: const EdgeInsets.only(bottom: 10),
        padding: const EdgeInsets.all(14),
        decoration: BoxDecoration(
          color: isDark ? const Color(0xFF1E1E1E) : Colors.white,
          borderRadius: BorderRadius.circular(16),
          border: Border.all(
            color: isDark ? const Color(0xFF333333) : const Color(0xFFF0F0F0),
          ),
        ),
        child: Row(
          children: [
            CircleAvatar(
              backgroundColor: avatarColor.withOpacity(0.2),
              radius: 20,
              child: Text(
                u.userId.substring(0, 1).toUpperCase(),
                style: GoogleFonts.inter(
                  fontWeight: FontWeight.bold,
                  color: avatarColor,
                ),
              ),
            ),
            const SizedBox(width: 12),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    u.userId,
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: GoogleFonts.inter(
                      fontWeight: FontWeight.w600,
                      fontSize: 13,
                      color: isDark ? Colors.white : Colors.black87,
                    ),
                  ),
                  Text(
                    '${u.count} calls • Rev: ${_money(u.revenueUsd)}',
                    style: GoogleFonts.inter(
                        fontSize: 11,
                        color: isDark ? Colors.white38 : Colors.black45),
                  ),
                ],
              ),
            ),
            Column(
              crossAxisAlignment: CrossAxisAlignment.end,
              children: [
                Text(
                  '-${_money(u.costUsd)}',
                  style: GoogleFonts.inter(
                    fontWeight: FontWeight.w600,
                    color: isDark ? Colors.white70 : Colors.black54,
                    fontSize: 12,
                  ),
                ),
                Text(
                  _money(profit),
                  style: GoogleFonts.inter(
                    fontWeight: FontWeight.bold,
                    color: profit >= 0
                        ? const Color(0xFF34C759)
                        : const Color(0xFFFF3B30),
                    fontSize: 13,
                  ),
                ),
              ],
            ),
          ],
        ),
      ),
    );
  }

  // --- Common Widgets ---

  Widget _buildSectionTitle(bool isDark, String title) {
    return Text(
      title.toUpperCase(),
      style: GoogleFonts.inter(
        fontSize: 12,
        fontWeight: FontWeight.bold,
        color: isDark ? const Color(0xFF888888) : const Color(0xFF888888),
        letterSpacing: 0.5,
      ),
    );
  }

  Widget _buildInfoBox(bool isDark) {
    return Container(
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: isDark ? const Color(0xFF1E1E1E) : const Color(0xFFE0F2FE),
        borderRadius: BorderRadius.circular(12),
        border: Border.all(
            color: isDark
                ? Colors.blue.withOpacity(0.3)
                : Colors.blue.withOpacity(0.1)),
      ),
      child: Row(
        children: [
          const Icon(Icons.info_outline, size: 20, color: Colors.blue),
          const SizedBox(width: 10),
          Expanded(
            child: Text(
              'Podaci se ažuriraju u realnom vremenu iz Firestore agregacija.',
              style: GoogleFonts.inter(
                  fontSize: 12,
                  color: isDark ? Colors.blue.shade200 : Colors.blue.shade800),
            ),
          ),
        ],
      ),
    );
  }

  Widget _loadingView(bool isDark) => Center(
        child: CircularProgressIndicator(
          color: isDark ? Colors.white : Colors.black,
          strokeWidth: 2,
        ),
      );

  Widget _emptyView(bool isDark, String msg) => Center(
        child: Padding(
          padding: const EdgeInsets.all(20.0),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              Icon(Icons.inbox,
                  size: 40, color: isDark ? Colors.white24 : Colors.black12),
              const SizedBox(height: 10),
              Text(msg,
                  style: GoogleFonts.inter(
                      color: isDark ? Colors.white54 : Colors.black45)),
            ],
          ),
        ),
      );

  IconData _kindIcon(String kind) {
    final k = kind.toLowerCase();
    if (k.contains('llm')) return Icons.psychology;
    if (k.contains('image')) return Icons.image;
    if (k.contains('voice')) return Icons.mic;
    if (k.contains('web')) return Icons.public;
    return Icons.extension;
  }
}

// --- Data Models ---

class _DayRow {
  final String day;
  final double costUsd;
  final double infraUsd;
  final double revenueUsd;
  final int count;
  final double profitUsd;
  final double? margin;

  _DayRow({
    required this.day,
    required this.costUsd,
    required this.infraUsd,
    required this.revenueUsd,
    required this.count,
    required this.profitUsd,
    required this.margin,
  });
}

class _IntegrationAgg {
  final String key;
  final String kind;
  final String provider;
  final String model;
  double costUsd = 0;
  int count = 0;

  _IntegrationAgg({
    required this.key,
    required this.kind,
    required this.provider,
    required this.model,
  });

  String get prettyTitle {
    final p = provider.isEmpty ? 'na' : provider;
    final m = model.isEmpty ? 'na' : model;
    return (p == 'na' && m == 'na') ? key : '$p $m';
  }
}

class _UserAgg {
  final String userId;
  double costUsd = 0;
  double revenueUsd = 0;
  int count = 0;
  int revenueCount = 0;

  _UserAgg(this.userId);
}

// --- Premium Smooth Chart Painter ---

class _PremiumChartPainter extends CustomPainter {
  final List<double> values;
  final Color lineColor;
  final bool isDark;

  _PremiumChartPainter({
    required this.values,
    required this.lineColor,
    required this.isDark,
  });

  @override
  void paint(Canvas canvas, Size size) {
    if (values.isEmpty) return;

    // Normalizacija
    double minV = values.reduce(math.min);
    double maxV = values.reduce(math.max);
    if (minV > 0) minV = 0; // Uvijek uključi 0 ako su sve pozitivne
    if (maxV < 0) maxV = 0; // Uvijek uključi 0 ako su sve negativne
    final range = maxV - minV;
    final displayRange = range == 0 ? 1.0 : range;

    final w = size.width;
    final h = size.height;

    // Grid lines (3 horizontalne linije)
    final gridPaint = Paint()
      ..color = (isDark ? Colors.white : Colors.black).withOpacity(0.05)
      ..style = PaintingStyle.stroke
      ..strokeWidth = 1;

    canvas.drawLine(Offset(0, h), Offset(w, h), gridPaint); // Bottom
    canvas.drawLine(Offset(0, h / 2), Offset(w, h / 2), gridPaint); // Middle
    canvas.drawLine(Offset(0, 0), Offset(w, 0), gridPaint); // Top

    // Putanja linije
    final path = Path();
    final pointDistance = w / (values.length - 1);

    Offset getPt(int i) {
      final x = i * pointDistance;
      // Invertiramo Y jer je canvas 0 gore
      final normalizedY = (values[i] - minV) / displayRange;
      final y = h - (normalizedY * h);
      return Offset(x, y);
    }

    path.moveTo(getPt(0).dx, getPt(0).dy);

    for (int i = 0; i < values.length - 1; i++) {
      final p1 = getPt(i);
      final p2 = getPt(i + 1);

      // Bezier control points za glatku liniju
      final controlPoint1 = Offset(p1.dx + (p2.dx - p1.dx) / 2, p1.dy);
      final controlPoint2 = Offset(p1.dx + (p2.dx - p1.dx) / 2, p2.dy);

      path.cubicTo(
        controlPoint1.dx,
        controlPoint1.dy,
        controlPoint2.dx,
        controlPoint2.dy,
        p2.dx,
        p2.dy,
      );
    }

    // Gradient Fill
    final fillPath = Path.from(path);
    fillPath.lineTo(w, h);
    fillPath.lineTo(0, h);
    fillPath.close();

    final gradient = LinearGradient(
      begin: Alignment.topCenter,
      end: Alignment.bottomCenter,
      colors: [
        lineColor.withOpacity(0.3),
        lineColor.withOpacity(0.0),
      ],
    );

    final fillPaint = Paint()
      ..shader = gradient.createShader(Rect.fromLTWH(0, 0, w, h))
      ..style = PaintingStyle.fill;

    canvas.drawPath(fillPath, fillPaint);

    // Stroke
    final strokePaint = Paint()
      ..color = lineColor
      ..strokeWidth = 3
      ..style = PaintingStyle.stroke
      ..strokeCap = StrokeCap.round
      ..strokeJoin = StrokeJoin.round;

    canvas.drawPath(path, strokePaint);

    // Highlight points (samo zadnja točka za čistoću)
    final lastPt = getPt(values.length - 1);
    canvas.drawCircle(lastPt, 5, Paint()..color = lineColor);
    canvas.drawCircle(
        lastPt, 3, Paint()..color = isDark ? Colors.black : Colors.white);
  }

  @override
  bool shouldRepaint(covariant _PremiumChartPainter oldDelegate) {
    return oldDelegate.values != values || oldDelegate.lineColor != lineColor;
  }
}
