import * as I18N from "./index"
import * as fs from "node:fs/promises"
import * as url from "node:url"
import { Dirent } from "node:fs"
import * as path from "node:path"
import chalk from "chalk"
///@ts-ignore
import Translation from "./translation.ts"

const __filename = url.fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const rootPath = path.resolve(__dirname, "..")
const log = console.log

const set = async (_p: string, context: any) => {
		log(chalk.green(`update ${_p}`))
		await fs.writeFile(_p, JSON.stringify(context, null, 4))
	},
	get = async <T>(_p: string): Promise<T | undefined> => {
		if (!(await isExists(_p))) return

		const _r = await fs.readFile(_p, { encoding: "utf-8" })

		if (!_r) return
		try {
			return JSON.parse(_r)
		} catch (error) {
			console.error("json parse faild: " + _p)
			return
		}
	},
	isExists = async (_p: string): Promise<boolean> => {
		try {
			await fs.access(_p)
			return true
		} catch (error) {
			return false
		}
	},
	toFlat = (lan: I18N.Lan, map: I18N.LanMap = new Map(), mapKey: Record<string, string[]> = {}, parents: string[] = []): [typeof map, typeof mapKey] => {
		Object.entries(lan)
			.map((item) => {
				const indexs = [...parents, item[0]]
				const _i = indexs.join(".")
				mapKey[_i] = indexs

				if (typeof item[1] === "object" && item[1]) {
					map.set(mapKey[_i], undefined)
					toFlat(item[1], map, mapKey, indexs)
				} else {
					mapKey[_i] = indexs
					map.set(mapKey[_i], item[1])
				}
			})
			.flat(1)
		return [map, mapKey]
	},
	toReduce = (
		lan: I18N.Lan,
		_referResMap: I18N.LanMap,
		referResMapKey: Record<string, string[]>,
		parents: string[] = [],
		removed: { key: typeof parents; value: string }[] = []
	): { remainder: I18N.Lan; removed: typeof removed } => {
		const remainder = Object.fromEntries(
			Object.entries(lan)
				.map((item) => {
					const indexs = [...parents, item[0]]
					const _i = referResMapKey[indexs.join(".")]
					if (!_referResMap.has(_i)) {
						removed.push({ key: indexs, value: JSON.stringify(item[1]) })
						log(chalk.yellow(`removed: ${indexs}`))
						return []
					}

					if (typeof item[1] === "object" && item[1]) {
						const _children = toReduce(item[1] as I18N.Lan, _referResMap, referResMapKey, indexs, removed)
						return [item[0], _children.remainder]
					}

					return item
				})
				.filter((item) => item.length === 2)
		)
		return { remainder, removed }
	},
	toAdd = (lan: I18N.Lan, _referResMap: I18N.LanMap, referResMapKey: Record<string, string[]>, parents: string[] = [], added: { key: typeof parents; value: string }[] = []) => {
		for (const [key, value] of _referResMap.entries()) {
			const _value = value === undefined ? {} : value
			let last: I18N.Lan = lan,
				i = 0
			while (i <= key.length - 1) {
				if (i === key.length - 1) {
					if (!(key[i] in last)) {
						last[key[i]] = _value
						added.push({ key: key, value: JSON.stringify(_value) })
						log(chalk.blueBright(`added: ${key}`))
					}
				} else {
					last[key[i]] === undefined && (last[key[i]] = {})
					last = last[key[i]]
				}
				i++
			}
		}
		return { result: lan, added: added }
	},
	getConfig = async (_rootPath: string): Promise<I18N.Config | undefined> => {
		const json = await get<I18N.Config>(path.resolve(_rootPath, "i18n.json"))
		if (json) return json
		const href = url.pathToFileURL(path.resolve(_rootPath, "i18n")).href

		const importFile = async (type: "ts" | "js"): Promise<{ default: I18N.Config } | undefined> => {
			try {
				return await import(href + "." + type)
			} catch (error) {
				return
			}
		}

		const js = await importFile("js")
		if (js) return js.default

		const ts = await importFile("ts")
		if (ts) return ts.default

		return
	},
	toTranslate = async (lanItems: I18N.TranslationItem[], config: I18N.Config, refer: I18N.Config["refer"], translator: I18N.Translator) => {
		const error: I18N.TranslationItem[] = []
		const result = await Promise.all(
			lanItems.map(async (item, index) => {
				const result = await translating(config, { from: refer, to: item.lanName, text: item.value, key: item.key }, index, translator)
				log(chalk.green(`${item.lanName} ${item.key}`))
				if (!result) {
					error.push(item)
					return item
				}
				return { ...item, value: result }
			})
		).then((result) => result)
		return { result, error }
	},
	translating = async (config: I18N.Config, detail: Parameters<I18N.Translator>[1], index: number, translator: I18N.Translator) => {
		return new Promise<string | undefined>((resolve, reject) => {
			setTimeout(async () => {
				const result = await translator(config, detail)
					.then((res: any) => res)
					.catch((err: any) => err)
				if (typeof result === "object") {
					log(chalk.red(JSON.stringify(result)))
					resolve(undefined)
					return
				}
				resolve(result)
			}, index * 1000)
		})
	},
	toReplace = (lanItems: I18N.TranslationItem[], lanResults: I18N.CollectedLans[]) => {
		const _find = (lanName: string) => lanResults.find((item) => item.name === lanName)
		lanItems.forEach((item) => {
			const lan = _find(item.lanName)
			if (!lan) return
			let last: I18N.Lan = lan.result,
				i = 0

			while (i <= item.key.length - 1) {
				if (i === item.key.length - 1) {
					last[item.key[i]] = item.value
				} else {
					last = last[item.key[i]]
				}
				i++
			}
		})
		lanResults.forEach((item) => set(item.path, item.result))
	}

;(async () => {
	const config = await getConfig(rootPath)
	if (!config) return

	const destination = path.resolve(rootPath, config.destination)

	const toCollect = async (paths: Dirent[] | string, parent: string): Promise<I18N.Lan[]> => {
		const empty = {}
		return (
			await Promise.all(
				(typeof paths === "string" ? [paths] : paths).map(async (item) => {
					const name = typeof item === "string" ? item : item.name

					if (/^node_modules$/.test(name)) return empty
					const _p = path.resolve(rootPath, parent, name)
					if (/node_modules/.test(_p)) return empty
					if (/.git/.test(_p)) return empty

					try {
						const _ps = await fs.readdir(_p, { encoding: "utf8", withFileTypes: true })
						const res = await toCollect(_ps, _p)

						return res.length > 0 ? res : empty
					} catch (error) {}

					if (/\.lan\.json$/.test(_p)) {
						const _res = await get<I18N.Lan>(_p)
						if (!_res) return empty
						log(_p)
						const _name = path.basename(_p).replace(/\.lan\.json/, "")
						return Object.fromEntries([[_name, _res]])
					}
					return empty
				})
			)
		)
			.flat(1)
			.filter((item) => !Object.is(empty, item))
	}

	const referRes = await (async () => {
		return (await toCollect(rootPath, ""))
			.map((item) => Object.entries(item).flat(1))
			.reduce<I18N.Lan>((a, c) => {
				const _a =
					a instanceof Array
						? {
								[a[0] as string]: a[1],
						  }
						: a
				const [_name, _val] = c as [string, I18N.Lan]

				_a[_name] = {
					...(_name in _a ? (_a[_name] as I18N.Lan) : {}),
					..._val,
				}
				return _a
			}, {})
	})()
	const [referResMap, referResMapKey] = toFlat(referRes)

	if (!(await isExists(destination))) {
		await fs.mkdir(destination)
	}

	set(path.resolve(destination, `${config.refer}.json`), referRes)
	const lanResults = (
		await Promise.all(
			config.culture
				.filter((item) => item !== config.refer)
				.map(async (item) => {
					const _p = path.resolve(destination, `${item}.json`)
					if (!(await isExists(_p))) {
						return { name: item, result: {}, path: _p }
					}
					const _lan = await get<I18N.Lan>(_p)
					if (_lan) return { name: item, result: _lan, path: _p }
					return
				})
		)
	)
		.filter((item) => item !== undefined)
		.map((item) => {
			const _item = item as {
				name: string
				path: string
				result: I18N.Lan
			}
			const { remainder, removed } = toReduce(_item.result, referResMap, referResMapKey)
			const { result, added } = toAdd(remainder, referResMap, referResMapKey)

			set(_item.path, result)
			return {
				name: _item.name,
				path: _item.path,
				result: result,
				added,
				removed,
			}
		})

	if (config.generateConclusion === true) {
		const added = lanResults.map((item) => [item.name, Object.fromEntries(item.added.map((el) => [el.key.join(","), el.value]))])
		const removed = lanResults.map((item) => [item.name, Object.fromEntries(item.removed.map((el) => [el.key.join(","), el.value]))])
		const logInfo = { added: Object.fromEntries(added), removed: Object.fromEntries(removed) }
		set(path.resolve(destination, `_conclusion.json`), logInfo)
	}

	if (!config.translation || !config.translation.auto) return

	const translator =
		typeof config.translation.custom === "function"
			? config.translation.custom
			: Translation[config.translation.resolve?.translator]
			? Translation[config.translation.resolve?.translator]
			: undefined
	if (typeof translator !== "function") {
		log(chalk.red(`translator is not available, please check your resolve setting`))
		return
	}

	const translation = config.translation as I18N.Translation
	const lanItems = lanResults.map((_lan) => _lan.added.filter((item) => item.value !== "{}").map((item) => ({ ...item, lanName: _lan.name }))).flat(1)

	const { result: translationResults, error } = await toTranslate(lanItems, config, config.refer, translator)
	toReplace(translationResults, lanResults)

	if (error.length > 0 && typeof translation.retryTime === "number" && translation.retryTime > -1) {
		let current = 0,
			errors = error
		while (current <= translation.retryTime && errors.length > 0) {
			const { result: translationResults, error } = await toTranslate(lanItems, config, config.refer, translator)
			toReplace(translationResults, lanResults)
			errors = error
			current++
		}
	}
})()
