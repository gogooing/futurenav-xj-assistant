import useSWR from 'swr'
import { getSettings } from '../utils'

export const useToneType = () => {
    const { data: toneType, mutate: setToneType } = useSWR(
        [getSettings, 'tone'],
        async () => {
            const settings = await getSettings()
            return settings.tone
        },
        { suspense: true }
    )

    return {
        ToneType: toneType ?? 'default',
        setToneType,
    }
}
