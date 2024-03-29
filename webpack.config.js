const HtmlWebpackPlugin = require("html-webpack-plugin");
const CopyPlugin = require("copy-webpack-plugin");
const path = require("path");

module.exports = (_, argv) => ({
    entry: "./src/web/index.tsx",
    output: {
        filename: "index.js",
        path: path.resolve(__dirname, "build"),
    },
    resolve: {
        extensions: [".tsx", ".ts", ".js"],
    },
    module: {
        rules: [
            {
                test: /\.tsx?$/,
                exclude: /(node_modules|bower_components)/,
                use: {
                    loader: "swc-loader",
                    options: {
                        jsc: {
                            parser: {
                                syntax: "typescript",
                                tsx: true,
                                decorators: true,
                            },
                            transform: {
                                react: {
                                    pragma: "React.createElement",
                                    pragmaFrag: "React.Fragment",
                                    throwIfNamespace: true,
                                    development: false,
                                    useBuiltins: false,
                                    runtime: "automatic",
                                },
                            },
                            target: "es2020",
                            minify:
                                argv.mode === "production"
                                    ? { compress: true, mangle: true }
                                    : undefined,
                        },
                    },
                },
            },
            {
                test: /\.css$/,
                use: ["style-loader", "css-loader"],
            },
            {
                test: /\.svg$/,
                use: ["@svgr/webpack"],
            },
            {
                test: /\.(ico|svg|png|jpg|gif|webp|mp4|wasm)$/i,
                use: [
                    {
                        loader: "url-loader",
                        options: {
                            limit: 4096,
                        },
                    },
                ],
            },
            {
                test: /\.xml$/,
                type: "asset/source",
            },
            {
                test: /\.vert|frag$/,
                type: "asset/source",
                use: "glslify-loader",
            },
        ],
    },
    plugins: [
        new HtmlWebpackPlugin({
            template: path.resolve(__dirname, "src", "web", "index.html"),
            filename: "index.html",
        }),
        new CopyPlugin({
            patterns: [
                {
                    from: "static",
                },
            ],
        }),
    ],
});
