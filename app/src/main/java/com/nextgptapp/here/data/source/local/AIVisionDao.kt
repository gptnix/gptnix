package com.nextgptapp.here.data.source.local

import androidx.room.Dao
import androidx.room.Insert
import androidx.room.OnConflictStrategy
import androidx.room.Query
import com.nextgptapp.here.data.model.ChatMessage
import com.nextgptapp.here.data.model.RecentChat
import kotlinx.coroutines.flow.Flow

@Dao
interface AIVisionDao {


    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun addChat(recentChat: RecentChat):Long

    @Query("SELECT * FROM tbl_recent_chat ORDER BY id DESC")
    suspend fun getAllChats(): MutableList<RecentChat>

    @Query("SELECT * FROM tbl_recent_chat WHERE title LIKE '%' || :query || '%'")
    suspend fun searchChats(query:String): MutableList<RecentChat>

    @Query("UPDATE tbl_recent_chat SET title=:title, content=:content WHERE id = :id")
    fun updateChat(id:Long,title:String, content: String): Int

    @Query("DELETE FROM tbl_recent_chat WHERE id = :id")
    suspend fun deleteChat(id: Long)

    @Query("DELETE FROM tbl_recent_chat")
    suspend fun deleteAllChats()

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun addMessage(chatMessage: ChatMessage):Long

    @Query("SELECT * FROM tbl_messages WHERE chat_id = :chatId ORDER BY id DESC")
    suspend fun getAllMessages(chatId: Long): List<ChatMessage>

    @Query("SELECT * FROM tbl_messages WHERE chat_id = :chatId ORDER BY id DESC")
    fun getAllMessagesAsFlow(chatId: Long): Flow<List<ChatMessage>>

    @Query("DELETE FROM tbl_messages WHERE chat_id = :chatId")
    suspend fun deleteAllMessages(chatId: Long)

    @Query("UPDATE tbl_messages SET download_status = :status WHERE id = :id")
    fun updateMessageStatus(id:Long,status: Int): Int

    @Query("UPDATE tbl_messages SET content = :content,url=:url WHERE id = :id")
    fun updateMessageContent(id:Long,content: String,url:String): Int

    @Query("SELECT * FROM tbl_messages WHERE chat_id = :chatId ORDER BY id DESC limit:limit")
     fun getMessages(chatId: Long,limit:Int): List<ChatMessage>

    @Query("""
        SELECT * FROM tbl_messages 
        WHERE id < :currentMessageId 
        ORDER BY id DESC 
        LIMIT 1
    """)
    suspend fun getPreviousMessage(currentMessageId: Long): ChatMessage?


}