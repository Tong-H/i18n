import typescript from '@rollup/plugin-typescript';
export default {
	input: "src/main.ts",
	output: {
		file: "bundle.js",
		format: "cjs",
	},
	plugins: [ typescript({ compilerOptions: {lib: ["es5", "es6", "dom"], target: "es5"}}) ]
}
