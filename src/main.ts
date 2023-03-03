import * as fs from "node:fs/promises"
import * as url from "node:url"
import { Dirent } from "node:fs"
import * as path from "node:path"
import chalk from "chalk"

type LanValue = null | undefined | string | number | boolean | Lan

interface Lan {
	[x: string]: LanValue
}
interface Config {
	exclude: string[]
	culture: string[]
	refer: string
	destination: string
}

const __filename = url.fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const rootPath = path.resolve(__dirname, "..")
const set = async (_p: string, context: any) => {
		console.log(chalk.green(`update ${_p}`))
		await fs.writeFile(_p, JSON.stringify(context, null, 4))
	},
	get = async <T>(_p: string): Promise<T | undefined> => {
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
	toFind = (index: string, _referRes: Lan) => {
		const indexs = index.split(".")
		let last: LanValue | undefined = _referRes,
			i = 0
		while (i <= indexs.length - 1 && last) {
			last = typeof last === "object" && last ? last[indexs[i]] : undefined
			i++
		}

		return i < indexs.length - 1 ? undefined : last
	},
	toReduce = (lan: Lan, _referRes: Lan, parents: string = ""): Lan => {
		
		return Object.fromEntries(
			Object.entries(lan)
				.map((item) => {
					const index = `${parents ? parents + "." : ""}${item[0]}`
					if (!toFind(index, _referRes)) {
						console.log(chalk.yellow(index))
						return []
					}

					if (typeof item[1] === "object" && item[1]) {
						return [item[0], toReduce(item[1] as Lan, _referRes, index)]
					}
					
					return item
				})
				.filter((item) => item.length === 2)
		)
	},
	toAdd = (lan: Lan, _referRes: Lan, parents: string = ""): Lan => {
		Object.entries(_referRes).forEach((item) => {
			const index = `${parents ? parents + "." : ""}${item[0]}`
			console.log(index, toFind(index, lan));
			
			if (!toFind(index, lan)) {
				const indexs = index.split(".")
				let last: Lan | undefined = lan,
					i = 0
				while (i <= indexs.length - 1 && last) {
					if (i === indexs.length - 1) {
						console.log(chalk.blueBright(index))
						last[item[0]] = item[1]
					} else last = last[indexs[i]] as Lan
					i++
				}
				return
			}

			if (typeof item[1] === "object" && item[1]) {
				toAdd(lan, item[1], index)
			}
			return item
		})
		return lan
	}

;(async () => {
	const config = await get<Config>(path.resolve(rootPath, "i18n.json"))
	if (!config) return

	const destination = path.resolve(rootPath, config.destination)

	const toCollect = async (paths: Dirent[] | string, parent: string): Promise<Lan[]> => {
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
						const _res = await get<Lan>(_p)
						if (!_res) return empty
						console.log(_p)
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
			.reduce<Lan>((a, c) => {
				const _a =
					a instanceof Array
						? {
								[a[0] as string]: a[1],
						  }
						: a
				const [_name, _val] = c as [string, Lan]

				_a[_name] = {
					...(_name in _a ? (_a[_name] as Lan) : {}),
					..._val,
				}
				return _a
			}, {})
	})()

	if (!(await isExists(destination))) {
		await fs.mkdir(destination)
	}

	set(path.resolve(destination, `${config.refer}.json`), referRes)
	;(
		await Promise.all(
			config.culture
				.filter((item) => item !== config.refer)
				.map(async (item) => {
					const _p = path.resolve(destination, `${item}.json`)
					if (!(await isExists(_p))) {
						return { name: item, res: referRes, path: _p }
					}
					const _lan = await get<Lan>(_p)
					return { name: item, res: _lan || {}, path: _p }
				})
		)
	).map((item) => {
		if (Object.is(item.res, referRes)) {
			set(item.path, item.res)
			return
		}
		const remainder = toReduce(item.res, referRes)
		const result = toAdd(remainder, referRes)
		set(item.path, result)
	})
})()
