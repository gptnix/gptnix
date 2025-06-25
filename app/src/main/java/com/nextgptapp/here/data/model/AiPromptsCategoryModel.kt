package com.nextgptapp.here.data.model

import com.nextgptapp.here.components.ConversationType

data class AiPromptsCategoryModel(
    var categoryTitle: String = "",
    var prompts: List<AiPromptModel>,
)


data class AiPromptModel(
    var image: Int,
    var title: String = "",
    var summery: String = "",
    var type: String = ConversationType.TEXT.name,
    val examplesList: List<String>
)
