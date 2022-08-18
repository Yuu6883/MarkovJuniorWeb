const nodeExternals = require("webpack-node-externals");

module.exports = {
    entry: "./src/ui/index.tsx",
    output: {
        filename: "index.js",
        path: path.resolve(__dirname, "build"),
    },
    resolve: {
        extensions: [".tsx", ".ts", ".js"],
    },
    externalsPresets: { node: true }, // in order to ignore built-in modules like path, fs, etc.
    externals: [nodeExternals()], // in order to ignore all modules in node_modules folder
};
