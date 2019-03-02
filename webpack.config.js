const webpack = require('webpack');
const path = require('path');
const nodeExternals = require('webpack-node-externals');
const HtmlWebpackPlugin = require('html-webpack-plugin');
const { spawn } = require('child_process');

const config = {
  mode: process.env.NODE_ENV === 'production' ? 'production' : 'development',
  target: 'electron-renderer',
  entry: path.resolve(__dirname, 'app'),
  output: {
    path: path.resolve(__dirname, 'dist'),
    publicPath: path.resolve(__dirname, '/'),
    filename: 'bundle.js'
  },
  module: {
    rules: [
      {
        test: /\.jsx?$/,
        use: 'babel-loader'
      }
    ]
  },
  externals: [nodeExternals()],
  resolve: {
    extensions: ['.js', '.jsx']
  },
  stats: {
    colors: true,
    children: false,
    chunks: false,
    modules: false
  },
  plugins: [
    new HtmlWebpackPlugin({
      template: path.resolve(__dirname, './app/index.html')
    })
  ]
};

if (config.mode === 'development') {
  config.devServer = {
    contentBase: path.resolve(__dirname, './dist'),
    publicPath: path.resolve(__dirname, '/'),
    stats: {
      colors: true,
      chunks: false,
      children: false
    },
    before: () => spawn('electron', ['.'], { shell: true, env: process.env, stdio: 'inherit' })
      .once('close', () => process.exit(0))
      .once('error', spawnError => console.error(spawnError))
  };

  config.plugins.push(new webpack.HotModuleReplacementPlugin());
}

module.exports = config;
