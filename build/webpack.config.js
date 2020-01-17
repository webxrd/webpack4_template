'use strict';
// 在Array.prototype.includes添加es2017的includes语法
require('@babel/polyfill');
const webpack = require('webpack');
const path = require('path');
const fs = require('fs');
// 解析html
const HTMLWebpackPlugin = require('html-webpack-plugin');
// 将CSS提取为独立的文件
const MiniCssExtractPlugin = require('mini-css-extract-plugin');
// js压缩
const UglifyJsPlugin = require('uglifyjs-webpack-plugin');
// css压缩
const OptimizeCss = require('optimize-css-assets-webpack-plugin');
const { CleanWebpackPlugin } = require('clean-webpack-plugin');
// glob获取文件
const glob = require('glob');
// 需要打包的目录地址
const SRC_PATH = path.resolve(__dirname, '../src');
// 打包入口文件目录
const ENTRY_PATH = path.join(SRC_PATH, 'entry');
// html文件
const TEMPLATE_DIR_PATH = path.resolve(SRC_PATH, 'pages');
// 打包结果的输出地址
const DIST_PATH = path.resolve(__dirname, '../dist');
// 静态资源的公共前缀。
const PUBLIC_PATH = '';// http://staticfile.webxxx.com


// 关于图片的解析
const htmlImgJX = [
    // html-withimg-loader配置可有可无。但是这个插件的依赖必须安装
    /*{
        test: /\.html$/,
        use: ["html-withimg-loader"]
    },*/
    // 解析html中img标签的图片，这个配置必须有。
    {
        test: /\.(png|jpe?g|gif|svg)$/i,
        loader: 'file-loader',
        options: {
            esModule: false,
            name: './static/images/[name].[hash:7].[ext]'
        }
    },
    // 这里不可以有。否则会生成一个1k文件。正好被img标签引入。导致图片无法显示，放在这里提醒自己
    /*{
        // limit 单位 b： 200*1024===200kb
        test: /\.(png|jpe?g|gif|svg)(\?.*)?$/,
        loader: 'url-loader',
        options: {
            limit: 1000,
            name: './static/images/[name].[hash:7].[ext]'
        }
    },*/
];

module.exports = (env, argv) => {
    // 模式
    const { mode } = argv;
    // 入口文件
    const entryFiles = {};
    const htmlFiles = [];
    const files = glob.sync(path.join(ENTRY_PATH, '/**/*.js'));
    files.forEach(function (p) {
        // 获取js文件名。用作html文件名
        let basename = path.basename(p, '.js');
        // 添加入口
        entryFiles[basename] = p;
        let htmlPlug = new HTMLWebpackPlugin({
            template: 'html-withimg-loader!' + TEMPLATE_DIR_PATH + '/' + basename + '.html',// 需要编译的html文件
            filename: basename + '.html',// 打包后的文件名称
            inject: 'body',// body head true，意为将引入script标签放在哪个位置。body底部，head中，页面最底部,默认值true
            minify: {// 压缩配置
                removeAttributeQuotes: mode === 'production',// 删除双引号
                collapseWhitespace: mode === 'production',// 删除空格。变成一行
            },
            // chunks: [ basename, 'common' ],// 在该html内引入splitChunks.生成的common，现在不需要要了。已经修复
            chunks: [ basename ],// 在该html内引入js
            hash: true,// 打包后的文件内所引入的文件。是否添加hash戳
        });
        // 添加html
        htmlFiles.push(htmlPlug);
    });
    return {
        // 模式。生产或者开发
        mode: mode,// production或development
        // 入口路径
        entry: entryFiles,
        // 出口路径
        output: {
            path: DIST_PATH,// 必须是绝对路径
            filename: path.posix.join('static', 'js/[name].[chunkhash].js'),
            // chunkFilename: path.posix.join('static', 'js/[id].[chunkhash].js'),
            publicPath: PUBLIC_PATH ,// 静态资源的公共前缀。
        },
        // 压缩配置
        optimization: {
            minimizer: [
                // js压缩。
                new UglifyJsPlugin({
                    cache: true,
                    parallel: true,
                    sourceMap: true
                }),
                // css压缩。
                new OptimizeCss()
            ],
            // 抽离成公共模块
            splitChunks: {
                cacheGroups: {
                    vendor: {
                        name: "vendor",
                        test: /[\\/]node_modules[\\/]/,
                        chunks: "all",
                        priority: 10 // 优先级
                    },
                    common: {
                        name: "common",
                        test: /[\\/]src[\\/]/,
                        minSize: 30000,
                        minChunks: 2,
                        chunks: "all",
                        priority: 5
                    }
                }
            }
        },
        // 模块加载器
        module: {
            rules: [
                // {
                //     // 将本配置注释，可以关闭Eslint语法检测
                //     test: /\.js$/,
                //     use: {
                //         // 关于《.eslintrc.json》文件可在《https://eslint.bootcss.com/demo/》网
                //         // 址内的《Rules Configuration》按钮内配置。并点
                //         // 击《Download .eslintrc.json file with this configuration》来进行下
                //         // 载。并在文件头部添加《.》，然后放到跟目录。
                //         loader: 'eslint-loader',
                //         options: {
                //             // 将此loader强制放在最下面。也就是先执行，因为webpack不仅仅遵循从右向左。
                //             // 还遵循从下至上。而eslint-loader必须先执行，才可以最好的效果，所以这里值为 "pre"
                //             enforce: 'pre',
                //         }
                //     }
                // },
                {
                    test: /\.js$/i,
                    use: {
                        loader: 'babel-loader',
                        options: {// 用babel-loader把es6转换成es5
                            presets: [
                                '@babel/preset-env'
                            ],
                            plugins: [
                                ['@babel/plugin-proposal-decorators', {'legacy': true}],// 转换es2017语法，比如装饰器
                                ['@babel/plugin-proposal-class-properties', {'loose': true}],// 转换es2017语法，比如Class类
                                '@babel/plugin-transform-runtime',// 转换es2017语法，比如Class类
                            ],
                        }
                    },
                    include: SRC_PATH,// 想要找哪个里面的js
                    exclude: /node_modules/,// 排除哪个文件内的js
                },
                // 匹配以.css结尾的文件。则使用该规则。
                {
                    test: /\.css$/i,
                    // use值字符串，只使用一个loader
                    // use值数组。使用一组loader
                    // loader值字符串，使用默认配置
                    // loader值对象，自定义某些配置
                    // loader执行顺序，从右往左，从下至上。顺序很重要
                    use: [
                        {
                            loader: MiniCssExtractPlugin.loader,
                            options: {
                            }
                        },
                        'css-loader',
                        {
                            loader: 'postcss-loader',
                            options: {
                                plugins: [
                                    require("autoprefixer")({
                                        browsers: [
                                            "ie >= 8",// ie版本大于等于ie8
                                            "Firefox >= 20",// 火狐20版本以上
                                            "Safari >= 5",// safari版本5.0以上
                                            "Android >= 4",// Android版本4以上
                                            "Ios >= 6",// Ios版本6以上
                                            "last 4 version"// 浏览器最新的四个版本
                                        ]
                                    })
                                ]
                            }
                        }
                    ]
                },
                // 匹配以.scss结尾的文件。则使用该规则。
                {
                    test: /\.scss$/i,
                    use: [
                        MiniCssExtractPlugin.loader,
                        'css-loader',
                        {
                            // 在css-loader执行前，添加css样式的浏览器前缀
                            loader: 'postcss-loader',
                            options: {
                                plugins: [
                                    require("autoprefixer")({
                                        browsers: [
                                            "ie >= 8",// ie版本大于等于ie8
                                            "Firefox >= 20",// 火狐20版本以上
                                            "Safari >= 5",// safari版本5.0以上
                                            "Android >= 4",// Android版本4以上
                                            "Ios >= 6",// Ios版本6以上
                                            "last 4 version"// 浏览器最新的四个版本
                                        ]
                                    })
                                ]
                            }
                        },
                        'sass-loader'
                    ]
                },
                // 解析图片的配置
                ...htmlImgJX,
                // 解析媒体文件
                {
                    test: /\.(mp4|webm|ogg|mp3|wav|flac|aac)$/i,
                    loader: 'url-loader',
                    options: {
                        limit: 1000,
                        outputPath: path.posix.join('static', 'media/[name].[hash:7].[ext]')
                    }
                },
                // 解析字体文件
                {
                    test: /\.(woff2?|eot|ttf|otf)(\?.*)?$/,
                    loader: 'url-loader',
                    options: {
                        limit: 10000,
                        name: path.posix.join('static', 'fonts/[name].[hash:7].[ext]')
                    }
                }
            ]
        },
        // 插件
        plugins: [
            ...htmlFiles,// 将html打包
            new CleanWebpackPlugin(),// 打包前，先删除output内容。
            new MiniCssExtractPlugin({
                // filename: path.posix.join('static', 'css/[name].[contenthash].css'),
                filename: './static/css/[name].[contenthash].css',
                minify: {// 压缩配置
                    collapseWhitespace: true,// 删除空格。变成一行
                },
            }),
            //
            // 为每个模块注入一个 模块
            // 例如，为每个模块注入一个 模块jquery(前提是先npm i jquery)模块，并且取名为$，下面可以填写多个
            // new webpack.ProvidePlugin({
            //     $: 'jquery'
            // })
        ],
        devServer: {
            hot: true,// 热更新,文件变化时。自动更新浏览器内容
            host: 'localhost',// ip地址
            port: 8080,// 端口
            historyApiFallback: true,// 项目中的404.默认转到index.html，一般无需开启此配置
            progress: true,// 进度条
            contentBase: './dist',// server指向的目录
            open: true,// 自动打开浏览器
            compress: true,// 启用gzip压缩。
            proxy: {// 代理表
                '/api': 'http://localhost:3000'
            },
            // https: true,
        }
    }
};