import * as I18N from "./index"

export default function setLan(lanRes: I18N.Lan) {
	if (!lanRes || typeof lanRes !== "object") return

	return (key: string | string[]) => {
		const _k = typeof key === "string" ? key.split(",") : key
		let last = lanRes,
			i = 0
		try {
			while (typeof last === "object" && i <= _k.length - 1) {
				if (i === _k.length - 1) {
					return last[_k[i]]
				} else last = last[_k[i]]
				i++
			}
		} catch (error) {
			return ""
		}
	}
}
