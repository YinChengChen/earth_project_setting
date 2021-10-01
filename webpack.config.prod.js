const path = require("path");
const HtmlWebpackPlugin = require("html-webpack-plugin");
const MiniCssExtractPlugin = require("mini-css-extract-plugin");
const TerserWebpackPlugin = require("terser-webpack-plugin");
const CssMinimizerPlugin = require("css-minimizer-webpack-plugin");

module.exports = {
    entry: [
        "./src/index.js"
    ],
    mode: 'production',
    module:{
        rules:[
            {
                test: /\.(s[ac]ss)$/,
                use:[
                    {
                        loader: MiniCssExtractPlugin.loader
                    },{
                        loader: "css-loader"
                    },{
                        loader: "postcss-loader",
                        options: {
                            postcssOptions:{
                                plugins: function(){
                                    return [
                                        require("autoprefixer")
                                    ];
                                }
                            }
                        }
                    },{
                        loader: "sass-loader"
                    }
                ]
            }
        ]
    },
    plugins:[
        new HtmlWebpackPlugin({
            template: "./src/html/index.html" // html 模板設定
        })
    ],    
    output: {
        path: path.resolve(__dirname, "dist"),
        filename: "bundle.js"
    },
    resolve: {
        extensions: [".js", ".vue"],
        alias: {
            "vue": "vue/dist/vue.esm-bundler.js" // 指定 vue 對應使用的真實 js 檔案
        }
    },
    optimization: {
        minimize: true,
        minimizer: [
            new TerserWebpackPlugin(),
            new MiniCssExtractPlugin(),
            new CssMinimizerPlugin()
        ],
    },
};