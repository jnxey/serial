// rollup.config.js
import resolve from "@rollup/plugin-node-resolve"; // 解析node_modules中的第三方模块
import babel from "@rollup/plugin-babel"; // 使用Babel转换JavaScript代码
import { terser } from "rollup-plugin-terser"; // 压缩JavaScript代码

export default {
  // 入口文件路径
  input: "src/rfid-factory.js",
  // 输出配置
  output: [
    {
      file: "../game-view/src/tools/rfid.js", // 输出文件路径
      format: "esm", // ES模块格式，适合现代打包工具
      sourcemap: false, // 生成sourcemap便于调试
    },
  ],
  // 插件配置
  plugins: [
    // 解析node_modules中的模块
    resolve({
      browser: true, // 解析浏览器环境模块
    }),
    // Babel转换，确保代码浏览器兼容性
    babel({
      babelHelpers: "bundled",
      exclude: "node_modules/**", // 排除node_modules
      extensions: [".js", ".jsx", ".ts", ".tsx"], // 支持的文件扩展名
    }),
    // 生产环境代码压缩
    terser(),
  ],
};
