export interface Config {
	culture: string[]
	refer: string
	destination: string
	exclude?: string[]
	generateConclusion?: boolean
	translation?: Translation
}
export type BasicLanValue = null | string | number | boolean
export type LanValue = LanValue | Lan
export interface Lan {
	[x: string]: LanValue
}
export type LanMap = Map<string[], BasicLanValue | undefined>
export interface TranslationItem {
	lanName: string
	value: string
	key: string[]
}
export type Translator = (config: Config, detail: { key: string[]; from: string; to: string; text: string }) => Promise<string | TranslationError>
export type TranslationError = {
	errorCode: -1 | -2 | -3
	body: any
} 
export interface CollectedLans {
	name: string
	path: string
	result: Lan
	added: {
		key: string[]
		value: string
	}[]
	removed: {
		key: string[]
		value: string
	}[]
}

export interface Youdao {
	api: string
	key: string
	appkey: string
}
export interface Translation {
	auto: boolean
	retryTime?: number
	resolve?: TranslationResolve
	custom?: Translator
}
export type TranslationResolve = TranslationResolveYoudao
export interface TranslationResolveYoudao {
	translator: "youdao"
	options: {
		key: string
		appkey: string
		api: string
		vocabId?: string
	}
}
