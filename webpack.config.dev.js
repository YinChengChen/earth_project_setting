const path = require("path");
const HtmlWebpackPlugin = require("html-webpack-plugin");
const MiniCssExtractPlugin = require("mini-css-extract-plugin");
const TerserWebpackPlugin = require("terser-webpack-plugin");
const CssMinimizerPlugin = require("css-minimizer-webpack-plugin");

module.exports = {
    devtool: "eval",
    entry: [
        "./src/index.js"
    ],
    mode: 'development',
    module:{
        rules:[
            {
                // 配置 babel 第一步
                test: /\.m?js$/,
                // 排除 node_modules 與 bower_components 底下資料 (第二步)
                exclude: /(node_modules|bower_components)/,
                use: {
                    loader: 'babel-loader',
                    // options: {
                    //     // 配置 Babel 解析器 (第三步)

                    // },
                },
            },{
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
            },{
                type: "javascript/auto",
                test: /\.json$/,
                use: [
                    {
                        loader: "file-loader",
                        // include: [path.resolve(__dirname, 'src/data')],
                        options: {
                            name: '[name].[ext]',
                        }
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
    devServer: {
        contentBase: path.join(__dirname, "dist"),
        hot: true,
        port: 9000,
    }
};