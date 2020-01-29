const HtmlWebpackPlugin = require('html-webpack-plugin');
module.exports = {
  entry: __dirname + "/src/index.js",
  output: {
    path: __dirname + '/dist',
    filename: 'bundle.js',
    publicPath: '/'
  },
  module: {
      rules: [
        {
          test: /\.js$/,
          use: {
              loader: 'babel-loader',
              options: {
                presets: ['@babel/preset-env'],
                plugins: ['transform-es2015-arrow-functions'],
              },
          }
        },
        {
          test: /\.(png|jpg|gif)$/i,
          use: [
            {
              loader: 'url-loader',
            }
          ],
        },
        {
          test: /\.css$/i,
          use: ['style-loader', 'css-loader'],
        }
      ]
  },
  plugins: [
      new HtmlWebpackPlugin({
          template: __dirname + "/src/index.html",
          inject: 'body'
      })
  ],
};
