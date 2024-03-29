/* eslint-disable camelcase */
import * as utils from '../common/utils'
import { fetchSSE } from './utils'
import { urlJoin } from 'url-join-ts'
import { v4 as uuidv4 } from 'uuid'
import { getLangConfig, getLangName, LangCode } from '../common/lang'
import { getUniversalFetch } from './universal-fetch'
import { Action } from './internal-services/db'
import { codeBlock, oneLine, oneLineTrim } from 'common-tags'

// export type TranslateMode = 'translate' | 'xiaojunai' | 'polishing' | 'summarize' | 'analyze' | 'improve-writing' | 'continue-writing' | 'topic-writing' | 'make-longer' | 'make-shorter' | 'explain-text' | 'explain-code' | 'big-bang'
export type TranslateMode = 'translate' | 'polishing' | 'summarize' | 'analyze' | 'improve-writing' | 'continue-writing' | 'topic-writing' | 'make-longer' | 'make-shorter' | 'explain-text' | 'explain-code' | 'big-bang'
export type Provider = 'OpenAI' | 'ChatGPT' | 'Azure'
export type APIModel =
    | 'gpt-3.5-turbo-0613'
    | 'gpt-4-0613'
    | string

// export type APIModel =
//     | 'gpt-3.5-turbo'
//     | 'gpt-3.5-turbo-0613'
//     | 'gpt-3.5-turbo-16k'
//     | 'gpt-3.5-turbo-16k-0613'
//     | 'gpt-4'
//     | 'gpt-4-0613'
//     | 'gpt-4-32k'
//     | 'gpt-4-32k-0613'
//     | string

interface BaseTranslateQuery {
    text: string
    writing?: boolean
    selectedWord?: string
    detectFrom: LangCode
    detectTo: LangCode
    mode?: Exclude<TranslateMode, 'big-bang'>
    action: Action
    onMessage: (message: { content: string; role: string; isWordMode: boolean; isFullText?: boolean }) => void
    onError: (error: string) => void
    onFinish: (reason: string) => void
    onStatusCode?: (statusCode: number) => void
    signal: AbortSignal
}

type TranslateQueryBigBang = Omit<
    BaseTranslateQuery,
    'mode' | 'action' | 'selectedWord' | 'detectFrom' | 'detectTo'
> & {
    mode: 'big-bang'
    articlePrompt: string
}

export type TranslateQuery = BaseTranslateQuery | TranslateQueryBigBang

export interface TranslateResult {
    text?: string
    from?: string
    to?: string
    error?: string
}

export const isAWord = (langCode: string, text: string) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { Segmenter } = Intl as any
    if (!Segmenter) {
        return false
    }
    const segmenter = new Segmenter(langCode, { granularity: 'word' })
    const iterator = segmenter.segment(text)[Symbol.iterator]()
    return iterator.next().value?.segment === text
}

export class QuoteProcessor {
    private quote: string
    public quoteStart: string
    public quoteEnd: string
    private prevQuoteStartBuffer: string
    private prevQuoteEndBuffer: string

    constructor() {
        this.quote = uuidv4().replace(/-/g, '').slice(0, 4)
        this.quoteStart = `<${this.quote}>`
        this.quoteEnd = `</${this.quote}>`
        this.prevQuoteStartBuffer = ''
        this.prevQuoteEndBuffer = ''
    }

    public processText(text: string): string {
        const deltas = text.split('')
        const targetPieces = deltas.map((delta) => this.processTextDelta(delta))
        return targetPieces.join('')
    }

    private processTextDelta(textDelta: string): string {
        if (textDelta === '') {
            return ''
        }
        if (textDelta.trim() === this.quoteEnd) {
            return ''
        }
        let result = textDelta
        // process quote start
        let quoteStartBuffer = this.prevQuoteStartBuffer
        // console.debug('\n\n')
        // console.debug('---- process quote start -----')
        // console.debug('textDelta', textDelta)
        // console.debug('this.quoteStartbuffer', this.quoteStartBuffer)
        // console.debug('start loop:')
        let startIdx = 0
        for (let i = 0; i < textDelta.length; i++) {
            const char = textDelta[i]
            // console.debug(`---- i: ${i} startIdx: ${startIdx} ----`)
            // console.debug('char', char)
            // console.debug('quoteStartBuffer', quoteStartBuffer)
            // console.debug('result', result)
            if (char === this.quoteStart[quoteStartBuffer.length]) {
                if (this.prevQuoteStartBuffer.length > 0) {
                    if (i === startIdx) {
                        quoteStartBuffer += char
                        result = textDelta.slice(i + 1)
                        startIdx += 1
                    } else {
                        result = this.prevQuoteStartBuffer + textDelta
                        quoteStartBuffer = ''
                        break
                    }
                } else {
                    quoteStartBuffer += char
                    result = textDelta.slice(i + 1)
                }
            } else {
                if (quoteStartBuffer.length === this.quoteStart.length) {
                    quoteStartBuffer = ''
                    break
                }
                if (quoteStartBuffer.length > 0) {
                    result = this.prevQuoteStartBuffer + textDelta
                    quoteStartBuffer = ''
                    break
                }
            }
        }
        // console.debug('end loop!')
        this.prevQuoteStartBuffer = quoteStartBuffer
        // console.debug('result', result)
        // console.debug('this.quoteStartBuffer', this.quoteStartBuffer)
        // console.debug('---- end of process quote start -----')
        textDelta = result
        // process quote end
        let quoteEndBuffer = this.prevQuoteEndBuffer
        // console.debug('\n\n')
        // console.debug('---- start process quote end -----')
        // console.debug('textDelta', textDelta)
        // console.debug('this.quoteEndBuffer', this.quoteEndBuffer)
        // console.debug('start loop:')
        let endIdx = 0
        for (let i = 0; i < textDelta.length; i++) {
            const char = textDelta[i]
            // console.debug(`---- i: ${i}, endIdx: ${endIdx} ----`)
            // console.debug('char', char)
            // console.debug('quoteEndBuffer', quoteEndBuffer)
            // console.debug('result', result)
            if (char === this.quoteEnd[quoteEndBuffer.length]) {
                if (this.prevQuoteEndBuffer.length > 0) {
                    if (i === endIdx) {
                        quoteEndBuffer += char
                        result = textDelta.slice(i + 1)
                        endIdx += 1
                    } else {
                        result = this.prevQuoteEndBuffer + textDelta
                        quoteEndBuffer = ''
                        break
                    }
                } else {
                    quoteEndBuffer += char
                    result = textDelta.slice(0, textDelta.length - quoteEndBuffer.length)
                }
            } else {
                if (quoteEndBuffer.length === this.quoteEnd.length) {
                    quoteEndBuffer = ''
                    break
                }
                if (quoteEndBuffer.length > 0) {
                    result = this.prevQuoteEndBuffer + textDelta
                    quoteEndBuffer = ''
                    break
                }
            }
        }
        // console.debug('end loop!')
        this.prevQuoteEndBuffer = quoteEndBuffer
        // console.debug('totally result', result)
        // console.debug('this.quoteEndBuffer', this.quoteEndBuffer)
        // console.debug('---- end of process quote end -----')
        return result
    }
}

const chineseLangCodes = ['zh-Hans', 'zh-Hant', 'lzh', 'yue', 'jdbhw', 'xdbhw']

export async function translate(query: TranslateQuery) {
    const fetcher = getUniversalFetch()
    let rolePrompt = ''
    let commandPrompt = ''
    let contentPrompt = query.text
    const assistantPrompts: string[] = []
    let quoteProcessor: QuoteProcessor | undefined
    const settings = await utils.getSettings()

    let tone = ''
    if (settings.tone && settings.tone !== 'default') {
        tone = settings.tone
    }
    let isWordMode = false

    if (query.mode === 'big-bang') {
        rolePrompt = oneLine`
        You are a professional writer
        and you will write ${query.articlePrompt}
        based on the given words`
        commandPrompt = oneLine`
        Write ${query.articlePrompt} of no more than 160 words.
        The article must contain the words in the following text.
        The more words you use, the better`
    } else {
        const sourceLangCode = query.detectFrom
        const targetLangCode = query.detectTo
        const sourceLangName = getLangName(sourceLangCode)
        const targetLangName = getLangName(targetLangCode)
        console.debug('sourceLang', sourceLangName)
        console.debug('targetLang', targetLangName)
        const toChinese = chineseLangCodes.indexOf(targetLangCode) >= 0
        const targetLangConfig = getLangConfig(targetLangCode)
        const sourceLangConfig = getLangConfig(sourceLangCode)
        console.log('Source language is', sourceLangConfig)
        rolePrompt = targetLangConfig.rolePrompt

        switch (query.action.mode) {
            case null:
            case undefined:
                if (
                    (query.action.rolePrompt ?? '').includes('${text}') ||
                    (query.action.commandPrompt ?? '').includes('${text}')
                ) {
                    contentPrompt = ''
                } else {
                    contentPrompt = query.text
                }
                rolePrompt = (query.action.rolePrompt ?? '')
                    .replace('${sourceLang}', sourceLangName)
                    .replace('${targetLang}', targetLangName)
                    .replace('${text}', query.text)
                commandPrompt = (query.action.commandPrompt ?? '')
                    .replace('${sourceLang}', sourceLangName)
                    .replace('${targetLang}', targetLangName)
                    .replace('${text}', query.text)
                if (query.action.outputRenderingFormat) {
                    commandPrompt += `. Format: ${query.action.outputRenderingFormat}`
                }
                break
            case 'translate':
                assistantPrompts = targetLangConfig.genAssistantPrompts()
                commandPrompt = targetLangConfig.genCommandPrompt(sourceLangConfig)
                contentPrompt = query.text
                if (!query.writing && query.text.length < 5 && toChinese) {
                    // 当用户的默认语言为中文时，查询中文词组（不超过5个字），展示多种翻译结果，并阐述适用语境。
                    rolePrompt = codeBlock`
                    ${oneLineTrim`
                    你是一个翻译引擎，
                    请将给到的文本翻译成${targetLangName}。
                    请列出3种（如果有）最常用翻译结果：单词或短语，
                    并列出对应的适用语境（用中文阐述）、音标或转写、词性、双语示例。
                    按照下面格式用中文阐述：`}
                        ${oneLineTrim`
                        <序号><单词或短语> · /<${targetLangConfig.phoneticNotation}>/
                        `}
                        [<词性缩写>] <适用语境（用中文阐述）>
                        例句：<例句>(例句翻译)
                    `
                    commandPrompt = ''
                }
                if (!query.writing && isAWord(sourceLangCode, query.text.trim())) {
                    isWordMode = true
                    if (toChinese) {
                        // 单词模式，可以更详细的翻译结果，包括：音标、词性、含义、双语示例。
                        rolePrompt = codeBlock`
                        ${oneLineTrim`
                        你是一个翻译引擎，请翻译给出的文本，只需要翻译不需要解释。
                        当且仅当文本只有一个单词时，
                        请给出单词原始形态（如果有）、
                        单词的语种、
                        ${targetLangConfig.phoneticNotation && '对应的音标或转写、'}
                        所有含义（含词性）、
                        双语示例，至少三条例句。
                        如果你认为单词拼写错误，请提示我最可能的正确拼写，
                        否则请严格按照下面格式给到翻译结果：
                        `}
                            <单词>
                            [<语种>]· / ${targetLangConfig.phoneticNotation && `<${targetLangConfig.phoneticNotation}>`}
                            [<词性缩写>] <中文含义>]
                            例句：
                            <序号><例句>(例句翻译)
                            词源：
                            <词源>
                        `
                        commandPrompt = '好的，我明白了，请给我这个单词。'
                        contentPrompt = `单词是：${query.text}`
                    } else {
                        const isSameLanguage = sourceLangCode === targetLangCode
                        rolePrompt = codeBlock`${oneLine`
                            You are a professional translation engine.
                            Please translate the text into ${targetLangName} without explanation.
                            When the text has only one word,
                            please act as a professional
                            ${sourceLangName}-${targetLangName} dictionary,
                            and list the original form of the word (if any),
                            the language of the word,
                            ${
                                targetLangConfig.phoneticNotation &&
                                'the corresponding phonetic notation or transcription, '
                            }
                            all senses with parts of speech,
                            ${isSameLanguage ? '' : 'bilingual '}
                            sentence examples (at least 3) and etymology.
                            If you think there is a spelling mistake,
                            please tell me the most possible correct word
                            otherwise reply in the following format:
                            `}
<word> (<original form>)
${oneLine`
[<language>]· /
${targetLangConfig.phoneticNotation && `<${targetLangConfig.phoneticNotation}>`}
`}
${oneLine`
[<part of speech>]
${isSameLanguage ? '' : '<translated meaning> / '}
<meaning in source language>
`}
Examples:
<index>. <sentence>(<sentence translation>)
Etymology:
<etymology>`
                        console.log(rolePrompt)
                        commandPrompt = 'I understand. Please give me the word.'
                        contentPrompt = `The word is: ${query.text}`
                    }
                }
                if (!query.writing && query.selectedWord) {
                    rolePrompt = oneLine`
                    You are an expert in the semantic syntax of the ${sourceLangName} language
                    and you are teaching me the ${sourceLangName} language.
                    I give you a sentence in ${sourceLangName} and a word in that sentence.
                    Please help me explain in ${targetLangName} language
                    what the word means in the sentence
                    and what the sentence itself means,
                    and if the word is part of an idiom in the sentence,
                    explain the idiom in the sentence
                    and give a few examples in ${sourceLangName} with the same meaning
                    and explain the examples in ${targetLangName} language,
                    and must in ${targetLangName} language.
                    If you understand, say yes, and then we will begin.`
                    commandPrompt = 'Yes, I understand. Please give me the sentence and the word.'
                    contentPrompt = `the sentence is: ${query.text}\n\nthe word is: ${query.selectedWord}`
                }
                break
            // case 'xiaojunai':
            //     rolePrompt =
            //         'Your role as an AI assistant named \"Xiaojun\"(“晓君”) is to use your advanced language processing capabilities to help people answer and solve any questions they may have. Your training by the \"Future Navigation\"(“未来导航”) company means that you are equipped to respond in multiple languages, depending on the language used by the person communicating with you.\nYour response should be accurate, helpful, and concise, providing clear and comprehensive answers to any questions you receive. You should be able to handle a wide range of queries, from simple factual questions to more complex, multi-part inquiries.\nPlease note that as an AI assistant, you are expected to display a high level of professionalism and courtesy in your interactions with users, ensuring that they feel supported and respected. Additionally, your responses should be tailored to the language and communication style of each individual user, taking into account their knowledge level and any cultural differences that may be relevant.'
            //     rolePrompt += tone ? 'Respond in ' + tone + ' tone' : ''
            //     commandPrompt = ``
            //     contentPrompt = '' + query.text + ''
            //     break
            case 'polishing':
                rolePrompt =
                    'You are a text polishing and translation expert. Please modify the sentence I provided according to my requirements. Please only provide the polished or translated text and do not include any additional explanations. At the same time, it is necessary to accurately convey the meaning of the original sentence. Additionally, your responses should be tailored to the language and communication style of each individual user, taking into account their knowledge level and any relevant cultural differences.'
                quoteProcessor = new QuoteProcessor()
                commandPrompt = tone ?
                    `Please use the ${tone} tone to polish this text in ${sourceLangName}. Only polish the text between ${quoteProcessor.quoteStart} and ${quoteProcessor.quoteEnd}.`
                    : `Please edit the following sentences in ${sourceLangName} to improve clarity, conciseness, and coherence, making them match the expression of native speakers.`
                contentPrompt = `${quoteProcessor.quoteStart}${query.text}${quoteProcessor.quoteEnd}`
                break
            case 'summarize':
                rolePrompt =
                    "You are an expert in text summarization and translation. Please modify the sentence I provided according to my requirements. Please only provide the summarized or translated text and do not include any additional explanations. At the same time, it is necessary to accurately convey the meaning of the original sentence. Additionally, your responses should be tailored to the language and communication style of each individual user, taking into account their knowledge level and any relevant cultural differences."
                quoteProcessor = new QuoteProcessor()
                commandPrompt = tone ?
                    oneLine`
                Please summarize this text with a ${tone} tone and concise language, 
                using the ${sourceLangName} language!
                Only summarize the text between 
                ${quoteProcessor.quoteStart} and ${quoteProcessor.quoteEnd}.
                `
                    :
                    oneLine`
                Please summarize this text in the most concise language
                and must use ${sourceLangName} language!
                Only summarize the text between 
                ${quoteProcessor.quoteStart} and ${quoteProcessor.quoteEnd}.
                `
                contentPrompt = `${quoteProcessor.quoteStart}${query.text}${quoteProcessor.quoteEnd}`
                break
            case 'analyze':
                rolePrompt = 'You are an expert in text/syntax analysis and translation. Please modify the sentence I provide based on my request. Please only provide text/syntax analysis or translated text, without any additional explanation. Additionally, your response should accurately convey the meaning of the original sentence while being tailored to each user\'s language and communication style, taking into account their level of knowledge and any relevant cultural differences.'
                quoteProcessor = new QuoteProcessor()
                commandPrompt = tone ? oneLine`Please use a ${tone} tone to analyze this text, explain its grammar and difficult words or phrases, and it must be written in ${sourceLangName}. Only analyze the writing in the text between ${quoteProcessor.quoteStart} and ${quoteProcessor.quoteEnd}.`
                    :
                    oneLine`
                    Please analyze this text and explain its grammar and difficult phrases. The text must be written in ${sourceLangName}. Only analyze the writing in the text between ${quoteProcessor.quoteStart} and ${quoteProcessor.quoteEnd}.`
                contentPrompt = `${quoteProcessor.quoteStart}${query.text}${quoteProcessor.quoteEnd}`
                break
            case 'improve-writing':
                rolePrompt =
                    'You are an expert in improving writing and translation. Please modify the sentences I provide according to my requirements. Please only provide the text that has been improved in writing or translation, without any other explanation. At the same time, it is necessary to accurately convey the meaning of the original sentence. In addition, your reply should be customized based on each user\'s language and communication style, taking into account their level of knowledge and any relevant cultural differences.'
                quoteProcessor = new QuoteProcessor()
                commandPrompt = tone ? oneLine`
                Please use a ${tone} tone to enhance the writing quality of this paragraph, and it must be written in ${sourceLangName}. Only improve writing the text between 
                ${quoteProcessor.quoteStart} and ${quoteProcessor.quoteEnd}.`
                    : oneLine`Please enhance the writing level of this text, and it must be done in ${sourceLangName} language. Only improve writing the text between 
                ${quoteProcessor.quoteStart} and ${quoteProcessor.quoteEnd}.`
                contentPrompt = `${quoteProcessor.quoteStart}${query.text}${quoteProcessor.quoteEnd}`
                break
            case 'continue-writing':
                rolePrompt =
                    'You are an expert in writing and translation. Please continue the sentence I provide according to my request. Please only provide the continued text and do not provide any other explanations. At the same time, accurately convey the meaning of the original sentence. In addition, your response should be tailored to each user\'s language and communication style, taking into account their level of knowledge and any relevant cultural differences.'
                quoteProcessor = new QuoteProcessor()
                commandPrompt = tone ? oneLine`
                Please continue writing this text in ${tone} tone, and it must be written in ${sourceLangName}. Only continue writing the text between
                ${quoteProcessor.quoteStart} and ${quoteProcessor.quoteEnd}.`
                    : oneLine`Please continue writing this text, and it must be written in ${sourceLangName}. Only continue writing the text between ${quoteProcessor.quoteStart} and ${quoteProcessor.quoteEnd}.`
                contentPrompt = `${quoteProcessor.quoteStart}${query.text}${quoteProcessor.quoteEnd}`
                break
            case 'topic-writing':
                rolePrompt =
                    'You are an expert in writing and translation. Please complete the writing based on the provided topic and requirements. Only provide the text of the writing without any additional explanation. At the same time, accurately convey the meaning of the topic. Additionally, your answer should be tailored to each user\'s language and communication style, taking into account their level of knowledge and any relevant cultural differences.'
                commandPrompt = tone ? oneLine`
                Please write an excellent article of no less than 800 words using the topic I provided. Use a ${tone} tone and write it in ${sourceLangName}. The topic is: `
                    : oneLine`Please write an excellent article of no less than 800 words using the topic I provided. You must use the ${sourceLangName} language. The topic is:`
                contentPrompt = '\n\n' + query.text + '\n\n'
                break
            case 'make-longer':
                rolePrompt =
                    'You are an expert in writing and translation. Please expand my text according to my requirements. Only provide the expanded text without any additional explanations. Also, accurately convey the original meaning of the text. In addition, your answer should be customized based on each user\'s language and communication style, taking into account their level of knowledge and any relevant cultural differences.'
                commandPrompt = tone ? oneLine`
                Please use a ${tone} tone to expand my text, and make sure to use ${sourceLangName} language. My original text is: `
                    : oneLine`Please expand my text, using ${sourceLangName} language. My original text is: `
                contentPrompt = '\n\n' + query.text + '\n\n'
                break
            case 'make-shorter':
                rolePrompt =
                    'You are an expert in writing and translation. Please shorten my text according to my requirements. Only provide the shortened text without any additional explanations. Also, accurately convey the original meaning of the text. In addition, your answer should be customized based on each user\'s language and communication style, taking into account their level of knowledge and any relevant cultural differences.'
                commandPrompt = tone ? oneLine`
                Please use a ${tone} tone to shorten my text, and make sure to use ${sourceLangName} language. My original text is: `
                    : oneLine`Please shorten my text, using ${sourceLangName} language. My original text is: `
                contentPrompt = '\n\n' + query.text + '\n\n'
                break
            case 'explain-text':
                rolePrompt = 'Your task is to explain complex texts or topics in a clear and concise way to people who are 18 years old or younger and have no prior knowledge of the text or topic. Your answer should avoid using technical or complex terminology and instead rely on simple language and relevant examples to convey the key concepts involved in the text or topic.\nPlease briefly introduce the text or topic and explain its relevance or importance. Then, outline the main ideas or concepts involved in the topic and provide clear and specific examples to help illustrate these ideas. Your response should also emphasize any common misunderstandings or misconceptions that may arise in relation to the text or topic.\nOverall, your answer should be easy to understand and engaging, providing the audience with a solid knowledge foundation they can build upon. Please note that you should avoid oversimplifying the text or omitting important details, as this may lead to confusion or misunderstanding.'
                commandPrompt = tone ? oneLine`Please explain this topic or text in ${sourceLangName} language using a ${tone} tone. The text or topic is as follows:`
                    : oneLine`
                Please explain this topic or text in ${sourceLangName} language. The text or topic is as follows:`
                contentPrompt = '\n\n' + query.text + '\n\n'
                break
            case 'explain-code':
                rolePrompt =
                    'You are a code explanation engine that can only explain code but not interpret or translate it. Also, please report bugs and errors (if any).'
                commandPrompt = oneLine`
                explain the provided code,
                regex or script in the most concise language
                and must use ${targetLangName} language!
                You may use Markdown.
                If the content is not code,
                return an error message.
                If the code has obvious errors, point them out.`
                contentPrompt = '```\n' + query.text + '\n```'
                break
        }
    }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let body: Record<string, any> = {
        model: settings.apiModel,
        temperature: 0,
        max_tokens: 1000,
        top_p: 1,
        frequency_penalty: 1,
        presence_penalty: 1,
        stream: true,
    }

    let apiKey = ''
    if (settings.provider !== 'ChatGPT') {
        apiKey = await utils.getApiKey()
    }
    const headers: Record<string, string> = {
        'Content-Type': 'application/json',
    }

    let isChatAPI = true
    if (settings.provider === 'Azure' && settings.apiURLPath && settings.apiURLPath.indexOf('/chat/completions') < 0) {
        // Azure OpenAI Service supports multiple API.
        // We should check if the settings.apiURLPath is match `/deployments/{deployment-id}/chat/completions`.
        // If not, we should use the legacy parameters.
        isChatAPI = false
        body[
            'prompt'
        ] = `<|im_start|>system\n${rolePrompt}\n<|im_end|>\n<|im_start|>user\n${commandPrompt}\n${contentPrompt}\n<|im_end|>\n<|im_start|>assistant\n`
        body['stop'] = ['<|im_end|>']
    } else if (settings.provider === 'ChatGPT') {
        let resp: Response | null = null
        resp = await fetcher(utils.defaultChatGPTAPIAuthSession, { signal: query.signal })
        if (resp.status !== 200) {
            query.onError?.('Failed to fetch ChatGPT Web accessToken.')
            query.onStatusCode?.(resp.status)
            return
        }
        const respJson = await resp?.json()
        apiKey = respJson.accessToken
        body = {
            action: 'next',
            messages: [
                {
                    id: uuidv4(),
                    role: 'user',
                    content: {
                        content_type: 'text',
                        parts: [
                            codeBlock`
                        ${rolePrompt}

                        ${commandPrompt}:
                        ${contentPrompt}
                        `,
                        ],
                    },
                },
            ],
            model: settings.apiModel, // 'text-davinci-002-render-sha'
            parent_message_id: uuidv4(),
            history_and_training_disabled: true,
        }
    } else {
        const messages = [
            {
                role: 'system',
                content: rolePrompt,
            },
            ...assistantPrompts.map((prompt) => {
                return {
                    role: 'user',
                    content: prompt,
                }
            }),
            {
                role: 'user',
                content: commandPrompt,
            },
        ]
        if (contentPrompt) {
            messages.push({
                role: 'user',
                content: contentPrompt,
            })
        }
        body['messages'] = messages
    }

    switch (settings.provider) {
        case 'OpenAI':
        case 'ChatGPT':
            headers['Authorization'] = `Bearer ${apiKey}`
            break

        case 'Azure':
            headers['api-key'] = `${apiKey}`
            break
    }

    let finished = false // finished can be called twice because event.data is 1. "finish_reason":"stop"; 2. [DONE]
    if (settings.provider === 'ChatGPT') {
        let length = 0
        await fetchSSE(`${utils.defaultChatGPTWebAPI}/conversation`, {
            method: 'POST',
            headers,
            body: JSON.stringify(body),
            signal: query.signal,
            onStatusCode: (status) => {
                query.onStatusCode?.(status)
            },
            onMessage: (msg) => {
                if (finished) return
                let resp
                try {
                    resp = JSON.parse(msg)
                    // eslint-disable-next-line no-empty
                } catch {
                    query.onFinish('stop')
                    finished = true
                    return
                }

                if (resp.is_completion) {
                    query.onFinish('stop')
                    finished = true
                    return
                }

                if (!resp.message) {
                    return
                }

                const { content, author } = resp.message
                if (author.role === 'assistant') {
                    const targetTxt = content.parts.join('')
                    let textDelta = targetTxt.slice(length)
                    if (quoteProcessor) {
                        textDelta = quoteProcessor.processText(textDelta)
                    }
                    query.onMessage({ content: textDelta, role: '', isWordMode })
                    length = targetTxt.length
                }
            },
            onError: (err) => {
                if (err instanceof Error) {
                    query.onError(err.message)
                    return
                }
                if (typeof err === 'string') {
                    query.onError(err)
                    return
                }
                if (typeof err === 'object') {
                    const { detail } = err
                    if (detail) {
                        const { message } = detail
                        if (message) {
                            query.onError(`ChatGPT Web: ${message}`)
                            return
                        }
                    }
                    query.onError(`ChatGPT Web: ${JSON.stringify(err)}`)
                    return
                }
                const { error } = err
                if (error instanceof Error) {
                    query.onError(error.message)
                    return
                }
                if (typeof error === 'object') {
                    const { message } = error
                    if (message) {
                        if (typeof message === 'string') {
                            query.onError(message)
                        } else {
                            query.onError(JSON.stringify(message))
                        }
                        return
                    }
                }
                query.onError('未知错误')
            },
        })
    } else {
        const url = urlJoin(settings.apiURL, settings.apiURLPath)
        await fetchSSE(url, {
            method: 'POST',
            headers,
            body: JSON.stringify(body),
            signal: query.signal,
            onMessage: (msg) => {
                if (finished) return
                let resp
                try {
                    resp = JSON.parse(msg)
                    // eslint-disable-next-line no-empty
                } catch {
                    query.onFinish('stop')
                    finished = true
                    return
                }

                const { choices } = resp
                if (!choices || choices.length === 0) {
                    return { error: 'No result' }
                }
                const { finish_reason: finishReason } = choices[0]
                if (finishReason) {
                    query.onFinish(finishReason)
                    finished = true
                    return
                }

                let targetTxt = ''
                if (!isChatAPI) {
                    // It's used for Azure OpenAI Service's legacy parameters.
                    targetTxt = choices[0].text

                    if (quoteProcessor) {
                        targetTxt = quoteProcessor.processText(targetTxt)
                    }

                    query.onMessage({ content: targetTxt, role: '', isWordMode })
                } else {
                    const { content = '', role } = choices[0].delta

                    targetTxt = content

                    if (quoteProcessor) {
                        targetTxt = quoteProcessor.processText(targetTxt)
                    }

                    query.onMessage({ content: targetTxt, role, isWordMode })
                }
            },
            onError: (err) => {
                if (err instanceof Error) {
                    query.onError(err.message)
                    return
                }
                if (typeof err === 'string') {
                    query.onError(err)
                    return
                }
                if (typeof err === 'object') {
                    const { detail } = err
                    if (detail) {
                        query.onError(detail)
                        return
                    }
                }
                const { error } = err
                if (error instanceof Error) {
                    query.onError(error.message)
                    return
                }
                if (typeof error === 'object') {
                    const { message } = error
                    if (message) {
                        if (typeof message === 'string') {
                            query.onError(message)
                        } else {
                            query.onError(JSON.stringify(message))
                        }
                        return
                    }
                }
                query.onError('未知错误')
            },
        })
    }
}
