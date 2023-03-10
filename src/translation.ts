import * as I18N from "./index"
import Crypto from "crypto-js"
import request from "request"

const youdao: I18N.Translator = (config, details) => {
	const {from, to, text} = details
	const options = config.translation?.resolve?.options as I18N.TranslationResolveYoudao["options"]
	return new Promise((resolve, reject) => {
		function truncate(q: string) {
			const len = q.length
			if (len <= 20) return q
			return q.substring(0, 10) + len + q.substring(len - 10, len)
		}

		const appKey = options.appkey
		const key = options.key
		const salt = new Date().getTime()
		const curtime = Math.round(new Date().getTime() / 1000)
		const str1 = appKey + truncate(text) + salt + curtime + key

		const sign = Crypto.SHA256(str1).toString(Crypto.enc.Hex)
		const data = {
			q: text,
			appKey: appKey,
			salt: salt,
			from: from,
			to: to,
			sign: sign,
			signType: "v3",
			curtime: curtime,
			vocabId: options.vocabId || "",
		}
		request.post(options.api, { form: data }, (error, response, body) => {
			if (error) {
				reject({ errorCode: -1, error: body })
				return
			}
			try {
				const _res = JSON.parse(body)
				_res.translation ? resolve(_res.translation[0]) : reject({ errorCode: -3, error: _res })
			} catch (error) {
				reject({ errorCode: -2, error: body })
			}
		})
	})
}

export default {
	youdao,
}
