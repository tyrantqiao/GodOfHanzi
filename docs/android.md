# 安卓版本

支持 Android 9 及以上，使用系统 Android WebView 加载 APK 内的完整游戏资源，首次启动无需网络。系统 WebView 应保持更新，以支持原生网页的对话框与样式。爬塔与制卡练习均可进入；本地存档使用原有 localStorage，覆盖安装保留，卸载会删除。安卓没有本地 Node 服务，服务端存档及 Kokoro 语音不可用；游戏会使用本地存档和既有静音回退。

启动后查询 GitHub 最新正式 Release，读取 android-update.json；版本号变大才后台自动下载 GodOfHanzi.apk。下载失败不影响游戏。安装前验证 SHA-256、应用包名、versionCode 和当前安装包签名，提示保存进度，随后调用系统安装器。首次安装更新须允许本应用“安装未知应用”，每次安装须系统确认，不支持静默安装。

## 发布

固定包名 com.godofhanzi.game；签名别名 hanzi。GitHub Secrets 保存 ANDROID_KEYSTORE_BASE64、ANDROID_STORE_PASSWORD、ANDROID_KEY_PASSWORD。本地 .android-private/ 中的签名材料必须私下备份，不得提交。丢失签名无法覆盖更新已有安装。

修改 android/version.json，versionCode 必须大于所有已发布版本，versionName 与标签一致。提交游戏与安卓工程后推送 android-v版本名称 标签，Android Release 工作流运行游戏测试、打包离线资源、构建已签名 APK，并发布 APK 和更新清单。workflow_dispatch 可仅构建并下载 artifact。发布到 Release 的名称必须保持 GodOfHanzi.apk 和 android-update.json。

本地开发需 JDK17、Android SDK35、Gradle8.9；执行 node scripts/package-android.mjs，再设置签名环境变量并执行 gradle -p android assembleRelease。不引入网页框架或 npm 运行依赖。

## 验证

CI 验证全部游戏纯规则测试及安卓编译。真机验收：安装首版；飞行模式下新局、路线、战斗、奇遇书写、奖励、笔斋、登顶/败北；保存后强退重启恢复；制卡画布触摸不滚动；旋转、返回键及导航到教学页；联网启动新版下载；拒绝安装权限/取消安装仍可游玩；允许权限后覆盖安装并恢复旧存档。以同签名 versionCode+1 的版本验证更新；损坏 APK 或签名不符应拒绝安装。此流程不能以编译通过替代真机验证。
