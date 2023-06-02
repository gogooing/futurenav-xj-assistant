# futurenav-xj-assistant
XiaoJun Assistant

同步
fix: rate and volume settings not work properly (#807)

# 如何编译

source "$HOME/.cargo/env"

// 参考https://tauri.app/zh-cn/rustup updatev1/guides/getting-started/prerequisites 安装tauri

git代理
git config --global http.proxy http://127.0.0.1:7890 
git config --global https.proxy http://127.0.0.1:7890

export https_proxy=http://127.0.0.1:7890 http_proxy=http://127.0.0.1:7890 all_proxy=socks5://127.0.0.1:7890

1.安装完Rust之后

1.1 更新
rustup update

1.2 检查版本
rustc --version

2.安装cli
yarn add -D @tauri-apps/cli

3.yarn clean

4.yarn install

//这里有时候会报错，electron安装不成功，加sudo试一下
//这里有时候需要添加config.toml

5.yarn build-tauri-renderer

6.yarn build-tauri


//去掉git代理

// 还需要配置mac、windows的签名


主要两个地方：
yarn config list
看yarn registry 有没有代理

和
看~/.cargo/config.toml文件


当config.toml里面配置了
yarn registry没有配置
git代理+http代理都配置+开了VPN

提示
There appears to be trouble with your network connection. Retrying...


当config.toml里面配置了
yarn registry没有配置
git代理代理配置+http代理没配置+开了VPN

提示
error An unexpected error occurred: "https://github.com/tauri-apps/tauri-plugin-autostart: ESOCKETTIMEDOUT".



当config.toml里面配置了
yarn registry没有配置
git代理代理没配置+http代理没配置+关了VPN

提示
成功了
