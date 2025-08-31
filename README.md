# NameAI 命名助手

NameAI 是一个强大的 VSCode 扩展，使用 AI 技术帮助开发者快速生成符合规范的变量命名。支持中文转英文、智能占位符替换、多种命名格式转换等功能。

## ✨ 主要功能

### 🚀 智能命名建议
- **选中代码** → **右键** → **"智能命名建议"** 
- 在右侧面板显示 4 个智能命名建议
- 支持占位符替换（foo、bar、temp 等）
- 悬停预览效果，实时查看替换结果

### 🎯 快速命名输入
- 快捷键：`Cmd+Alt+N` (Mac) / `Ctrl+Alt+N` (Windows)
- 弹出输入框，输入中文描述
- 获得 3 个英文变量名建议
- 一键插入到代码中

### ⚡ 快速格式转换
选中文本后使用快捷键快速转换命名格式：
- `Alt+1` - camelCase (小驼峰)
- `Alt+2` - PascalCase (大驼峰) 
- `Alt+3` - snake_case (下划线)
- `Alt+4` - _snake_case (前下划线)
- `Alt+5` - CONSTANT_CASE (常量)

### 🔧 自定义快捷键
在设置中配置自定义快捷键绑定：
```json
{
  "namecraft.customKeybindings": {
    "f3": "_snake_case",
    "f4": "CONSTANT_CASE", 
    "f5": "kebab-case"
  }
}
```

## 📋 使用场景

### 1. AI 给出更符合功能的命名
```javascript
// 选中整个函数
function temp() {
  const data = getData();
  return data.filter(item => item !== null);
}
```
右键选择"智能命名建议"，AI 会分析上下文并建议：
- `processData` 
- `filterData`
- `handleData`
- `manageData`

### 2. 中文转英文
输入中文描述"用户数据管理"，获得建议：
- `userDataManager`
- `userDataHandler` 
- `userInfoManager`

### 3. 快速格式转换
选中 `用户名称` 按 `Alt+3` 转换为 `user_name`

## ⚙️ 配置 API Key

### 第一步：获取 API Key
1. 访问 [SiliconFlow 控制台](https://cloud.siliconflow.cn/me/account/ak)
2. 登录或注册账号（支持微信/GitHub登录）
3. 点击"创建 API Key"
4. 复制生成的 API Key（格式：sk-xxxxxxxxx）

### 第二步：配置到插件
**方法一：通过命令面板**
1. 按 `Cmd+Shift+P` 打开命令面板
2. 输入 "NameCraft: 配置 API Key"
3. 粘贴你的 API Key

**方法二：通过设置界面**
1. 打开 VSCode 设置 (`Cmd+,`)
2. 搜索 "namecraft"
3. 找到 "Siliconflow Api Key" 配置项
4. 粘贴你的 API Key

### 第三步：开始使用
配置完成后，所有功能都可以正常使用了！

## 💡 使用技巧

### 占位符智能替换
当代码中包含占位符 `temp` 时，AI 会自动分析上下文提供智能命名建议。

### 多语言支持
插件会根据文件类型自动选择合适的命名风格：
- **JavaScript/TypeScript**: camelCase
- **Python**: snake_case
- **Java/C#**: camelCase
- **C/C++**: snake_case 或 camelCase

### 悬停预览
在右侧面板悬停不同建议时，编辑器中会实时显示替换效果，方便你预览选择。

## 🛠️ 常见问题

**Q: 提示"请先配置 API Key"？**
A: 按照上面的步骤配置 SiliconFlow API Key

**Q: API 调用失败？**
A: 检查网络连接和 API Key 是否正确

**Q: 自定义快捷键不生效？**
A: 配置后需要重启 VSCode

**Q: 没有找到合适的命名建议？**
A: 尝试提供更多的代码上下文，或者使用中文描述功能

## 📝 更新日志

### v1.0.0
- ✨ 智能命名建议面板
- 🎯 占位符智能替换
- ⚡ 快速格式转换
- 🔧 自定义快捷键配置
- 💡 悬停预览效果

---

## 💬 用户交流群

**QQ群：1061738579**

加入QQ群与其他开发者交流使用心得、反馈问题、获取使用技巧！

---

**开发者：** NameAI Team  
**许可证：** MIT  
**反馈：** 如有问题请提交 Issue 到项目仓库