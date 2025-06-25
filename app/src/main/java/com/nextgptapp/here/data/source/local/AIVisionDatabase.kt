package com.nextgptapp.here.data.source.local

import androidx.room.Database
import androidx.room.RoomDatabase
import com.nextgptapp.here.data.model.ChatMessage
import com.nextgptapp.here.data.model.RecentChat

@Database(
    entities = [RecentChat::class,ChatMessage::class],
    version = 2,
    exportSchema = false
)
abstract class AIVisionDatabase : RoomDatabase() {
    abstract fun aiVisionDao(): AIVisionDao
}