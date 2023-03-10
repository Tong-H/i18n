import * as I18N from "./src/index"


export default {
	exclude: ["portal/", "enums/"],
	culture: ["en", "zh-CHS", "ja"],
	refer: "en",
	destination: "demo/languages",
	generateConclusion: true,
	translation: {
		auto: true,
		retryTime: 3,
		custom: (config, detail) => {
			return new Promise<string>((resolve, reject) => {
				resolve("my translator")
			})
		},
		resolve: {
			translator: "youdao",
			options: {
				key: "b9Mj06A22QVXtYksYWaNwlXuGThbxB2x",
				appkey: "6deac4e33f0ad3a3",
				api: "https://openapi.youdao.com/api",
				vocabId: ""
			},
		},
	// 	items: [""],
	// 	dict: [""],
	},
} as I18N.Config
