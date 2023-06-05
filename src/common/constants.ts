import { TranslateMode } from './translate'

export const PREFIX = '__futurenav-xj-assistant'
export const builtinActionModes: { name: string; mode: Exclude<TranslateMode, 'big-bang'>; icon: string }[] = [
    {
        name: 'Translate',
        mode: 'translate',
        icon: 'MdOutlineGTranslate',
    },
    {
        name: 'Polishing',
        mode: 'polishing',
        icon: 'MdPalette',
    },
    {
        name: 'Summarize',
        mode: 'summarize',
        icon: 'MdOutlineSummarize',
    },
    {
        name: 'Analyze',
        mode: 'analyze',
        icon: 'MdOutlineAnalytics',
    },
    {
        name: 'Improve Writing',
        mode: 'improve-writing',
        icon: 'MdOutlineLightbulb',
    },
    {
        name: 'Continue Writing',
        mode: 'continue-writing',
        icon: 'MdOutlinePlaylistAdd',
    },
    {
        name: 'Topic Writing',
        mode: 'topic-writing',
        icon: 'MdOutlineGraphicEq',
    },
    {
        name: 'Make Longer',
        mode: 'make-longer',
        icon: 'MdOutlineTextIncrease',
    },
    {
        name: 'Make Shorter',
        mode: 'make-shorter',
        icon: 'MdOutlineTextDecrease',
    },
    {
        name: 'Explain Text',
        mode: 'explain-text',
        icon: 'MdJoinInner',
    },
    {
        name: 'Explain Code',
        mode: 'explain-code',
        icon: 'MdCode',
    },
]
