import * as vscode from 'vscode';
import { TranslationService } from './translationService';

export function activate(context: vscode.ExtensionContext) {
    console.log('NameCraft 插件已激活');

    const translationService = new TranslationService();

    // API Key配置命令
    const configureApiKeyCommand = vscode.commands.registerCommand('namecraft.configureApiKey', async () => {
        const config = vscode.workspace.getConfiguration('namecraft');
        const currentKey = config.get<string>('siliconflowApiKey', '');
        
        const apiKey = await vscode.window.showInputBox({
            placeHolder: 'sk-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx',
            prompt: '请输入你的 SiliconFlow API Key',
            value: currentKey,
            password: true,
            validateInput: (value: string) => {
                if (!value) return '请输入API Key';
                if (!value.startsWith('sk-')) return 'API Key应该以"sk-"开头';
                if (value.length < 20) return 'API Key长度不正确';
                return null;
            }
        });

        if (apiKey) {
            await config.update('siliconflowApiKey', apiKey, vscode.ConfigurationTarget.Global);
            vscode.window.showInformationMessage('API Key 配置成功！现在可以使用 NameCraft 的所有功能了。');
        }
    });

    // 检查API Key配置状态
    const checkApiKey = () => {
        const config = vscode.workspace.getConfiguration('namecraft');
        const apiKey = config.get<string>('siliconflowApiKey', '');
        
        if (!apiKey) {
            vscode.window.showWarningMessage(
                'NameCraft 需要配置 API Key 才能使用',
                '立即配置',
                '获取API Key'
            ).then(selection => {
                if (selection === '立即配置') {
                    vscode.commands.executeCommand('namecraft.configureApiKey');
                } else if (selection === '获取API Key') {
                    vscode.env.openExternal(vscode.Uri.parse('https://cloud.siliconflow.cn/me/account/ak'));
                }
            });
            return false;
        }
        return true;
    };

    // 快速命名命令
    const quickNamingCommand = vscode.commands.registerCommand('namecraft.quickNaming', async () => {
        if (!checkApiKey()) return;
        
        const editor = vscode.window.activeTextEditor;
        if (!editor) {
            vscode.window.showErrorMessage('请先打开一个文件');
            return;
        }

        const input = await vscode.window.showInputBox({
            placeHolder: '请输入中文描述，例如：用户数据管理',
            prompt: '描述你想要命名的变量或函数的功能'
        });

        if (!input) {
            return;
        }

        await processNaming(input, editor);
    });

    // 翻译选中文本命令
    const translateSelectionCommand = vscode.commands.registerCommand('namecraft.translateSelection', async () => {
        if (!checkApiKey()) return;
        
        const editor = vscode.window.activeTextEditor;
        if (!editor) {
            vscode.window.showErrorMessage('请先打开一个文件');
            return;
        }

        const selection = editor.selection;
        const selectedText = editor.document.getText(selection);

        if (!selectedText) {
            vscode.window.showErrorMessage('请先选中一些文本');
            return;
        }

        await processNaming(selectedText, editor);
    });


    // 分析代码上下文
    function analyzeCodeContext(editor: vscode.TextEditor): { language: string, variableType: string, context: string } {
        const fileName = editor.document.fileName;
        const fileExtension = fileName.split('.').pop()?.toLowerCase() || '';
        const position = editor.selection.active;
        const line = editor.document.lineAt(position.line).text;
        const linesBefore = position.line >= 2 ? 
            editor.document.lineAt(position.line - 1).text + ' ' + editor.document.lineAt(position.line - 2).text : '';
        
        // 检测编程语言
        const languageMap: Record<string, string> = {
            'js': 'JavaScript', 'ts': 'TypeScript', 'jsx': 'React', 'tsx': 'React',
            'py': 'Python', 'java': 'Java', 'c': 'C', 'cpp': 'C++', 'h': 'C/C++',
            'cs': 'C#', 'php': 'PHP', 'go': 'Go', 'rs': 'Rust', 'swift': 'Swift',
            'kt': 'Kotlin', 'rb': 'Ruby', 'dart': 'Dart', 'vue': 'Vue'
        };
        const language = languageMap[fileExtension] || 'Generic';
        
        // 分析变量类型
        let variableType = 'variable';
        const contextText = (line + ' ' + linesBefore).toLowerCase();
        
        if (contextText.includes('const ') || contextText.includes('final ') || contextText.includes('readonly ')) {
            variableType = 'constant';
        } else if (contextText.includes('function ') || contextText.includes('def ') || contextText.includes('func ')) {
            variableType = 'function';
        } else if (contextText.includes('class ') || contextText.includes('interface ') || contextText.includes('type ')) {
            variableType = 'class';
        } else if (contextText.includes('[]') || contextText.includes('array') || contextText.includes('list')) {
            variableType = 'array';
        } else if (contextText.includes('bool') || contextText.includes('is') || contextText.includes('has')) {
            variableType = 'boolean';
        }
        
        return { language, variableType, context: line.trim() };
    }

    // 处理命名逻辑 - 简化为3选项流程
    async function processNaming(input: string, editor: vscode.TextEditor) {
        try {
            // 分析代码上下文
            const { language, variableType } = analyzeCodeContext(editor);
            
            let suggestions: string[];
            
            // 检查是否包含占位符
            const hasPlaceholder = /\btemp\b/i.test(input);
            
            if (hasPlaceholder) {
                // 智能占位符替换模式
                suggestions = await vscode.window.withProgress({
                    location: vscode.ProgressLocation.Notification,
                    title: '正在分析代码上下文...',
                    cancellable: false
                }, async (progress) => {
                    progress.report({ increment: 100, message: '生成智能建议...' });
                    return await translationService.getSmartNamingSuggestions(input, language);
                });
            } else {
                // 中文翻译模式 - 返回3个最佳建议
                suggestions = await vscode.window.withProgress({
                    location: vscode.ProgressLocation.Notification,
                    title: '正在生成智能命名建议...',
                    cancellable: false
                }, async (progress) => {
                    progress.report({ increment: 100, message: '分析并生成建议...' });
                    return await translationService.getSmartTranslationSuggestions(input, language, variableType);
                });
            }

            // 显示选择列表
            await showSuggestionsPicker(suggestions, editor);
            
        } catch (error) {
            console.error('命名生成失败:', error);
            vscode.window.showErrorMessage(`命名生成失败: ${error}`);
        }
    }

    // 显示建议选择器
    async function showSuggestionsPicker(suggestions: string[], editor: vscode.TextEditor) {
        const quickPickItems = suggestions.map((suggestion, index) => ({
            label: suggestion,
            description: `建议 ${index + 1}`,
            detail: `将替换为: ${suggestion}`
        }));

        const selected = await vscode.window.showQuickPick(quickPickItems, {
            placeHolder: '选择一个命名建议',
            matchOnDescription: true,
            matchOnDetail: true
        });

        if (selected) {
            await insertNaming(editor, selected.label);
        }
    }

    // 插入命名到编辑器
    async function insertNaming(editor: vscode.TextEditor, naming: string) {
        await editor.edit(editBuilder => {
            const position = editor.selection.active;
            editBuilder.insert(position, naming);
        });
        vscode.window.showInformationMessage(`已插入命名：${naming}`);
    }


    // 快速转换命令 (Alt+1-5)
    const quickTransformCommands = [
        { id: 'namecraft.quickCamelCase', style: 'camelCase', key: 'alt+1' },
        { id: 'namecraft.quickPascalCase', style: 'PascalCase', key: 'alt+2' },
        { id: 'namecraft.quickSnakeCase', style: 'snake_case', key: 'alt+3' },
        { id: 'namecraft.quickUnderscoreCase', style: '_snake_case', key: 'alt+4' },
        { id: 'namecraft.quickConstantCase', style: 'CONSTANT_CASE', key: 'alt+5' }
    ];

    const quickCommands = quickTransformCommands.map(cmd => 
        vscode.commands.registerCommand(cmd.id, async () => {
            if (!checkApiKey()) return;
            
            const editor = vscode.window.activeTextEditor;
            if (!editor) {
                vscode.window.showErrorMessage('请先打开一个文件');
                return;
            }

            const selection = editor.selection;
            const selectedText = editor.document.getText(selection);

            if (!selectedText) {
                vscode.window.showErrorMessage('请先选中一些文本');
                return;
            }

            // 直接转换选中的文本
            await quickTransform(selectedText, cmd.style, editor, selection);
        })
    );


    // 快速转换函数 - 简化版
    async function quickTransform(text: string, targetStyle: string, editor: vscode.TextEditor, selection: vscode.Selection) {
        try {
            let result: string;
            
            // 如果包含中文，提取中文部分
            if (/[\u4e00-\u9fa5]/.test(text)) {
                const chineseText = text.match(/[\u4e00-\u9fa5\s]+/g)?.join('').trim() || text;
                
                // 调用AI直接转换为目标格式
                result = await translationService.translateToStyle(chineseText, targetStyle);
            } else {
                // 如果是英文，直接格式转换
                result = transformTextToStyle(text, targetStyle);
            }
            
            // 替换选中的文本
            await editor.edit(editBuilder => {
                editBuilder.replace(selection, result);
            });
            
            const styleName = getStyleDisplayName(targetStyle);
            vscode.window.showInformationMessage(`已转换为${styleName}：${result}`);
            
        } catch (error: any) {
            console.error('快速转换失败:', error);
            vscode.window.showErrorMessage(`${targetStyle}转换失败: ${error.message || error}`);
        }
    }

    // 格式转换工具函数
    function transformTextToStyle(text: string, style: string): string {
        const words = text.replace(/([a-z])([A-Z])/g, '$1 $2').replace(/[_-]/g, ' ').split(/\s+/).filter(w => w.length > 0);
        
        switch (style) {
            case 'camelCase':
                return words[0].toLowerCase() + words.slice(1).map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join('');
            case 'PascalCase':
                return words.map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join('');
            case 'snake_case':
                return words.map(w => w.toLowerCase()).join('_');
            case '_snake_case':
                return '_' + words.map(w => w.toLowerCase()).join('_');
            case 'CONSTANT_CASE':
                return words.map(w => w.toUpperCase()).join('_');
            case 'kebab-case':
                return words.map(w => w.toLowerCase()).join('-');
            default:
                return text;
        }
    }

    // 获取格式显示名称
    function getStyleDisplayName(style: string): string {
        const styleNames: Record<string, string> = {
            'camelCase': '小驼峰',
            'PascalCase': '大驼峰',
            'snake_case': '下划线',
            '_snake_case': '前下划线',
            'CONSTANT_CASE': '常量',
            'kebab-case': '短横线'
        };
        return styleNames[style] || style;
    }

    // 智能命名建议命令 - 显示webview面板
    const smartNamingCommand = vscode.commands.registerCommand('namecraft.smartNaming', async () => {
        if (!checkApiKey()) return;
        
        const editor = vscode.window.activeTextEditor;
        if (!editor) {
            vscode.window.showErrorMessage('请先打开一个文件');
            return;
        }

        const selection = editor.selection;
        const selectedText = editor.document.getText(selection);

        if (!selectedText) {
            vscode.window.showErrorMessage('请先选中一些文本');
            return;
        }

        await showSmartNamingPanel(selectedText, editor, selection);
    });

    // 显示智能命名面板
    async function showSmartNamingPanel(selectedText: string, editor: vscode.TextEditor, selection: vscode.Selection) {
        try {
            // 分析代码上下文
            const { language } = analyzeCodeContext(editor);
            
            // 检查是否包含占位符并找到占位符位置
            const placeholderRegex = /\btemp\b/gi;
            const placeholderMatches = Array.from(selectedText.matchAll(placeholderRegex));
            const hasPlaceholder = placeholderMatches.length > 0;
            
            let suggestions: string[];
            let targetPlaceholder = '';
            
            if (hasPlaceholder) {
                // 取第一个找到的占位符作为替换目标
                targetPlaceholder = placeholderMatches[0][0];
                
                // 智能占位符替换模式 - 获取4个建议
                suggestions = await vscode.window.withProgress({
                    location: vscode.ProgressLocation.Notification,
                    title: '正在分析代码上下文...',
                    cancellable: false
                }, async (progress) => {
                    progress.report({ increment: 100, message: '生成智能建议...' });
                    return await translationService.getSmartNamingSuggestions(selectedText, language);
                });
            } else if (/[\u4e00-\u9fa5]/.test(selectedText)) {
                // 中文翻译模式 - 获取3个建议然后扩展到4个
                const translationResults = await vscode.window.withProgress({
                    location: vscode.ProgressLocation.Notification,
                    title: '正在翻译中文...',
                    cancellable: false
                }, async (progress) => {
                    progress.report({ increment: 100, message: '生成翻译建议...' });
                    return await translationService.translate(selectedText);
                });
                suggestions = translationResults.slice(0, 4).map(result => result.text);
            } else {
                // 其他情况也使用智能命名
                suggestions = await translationService.getSmartNamingSuggestions(selectedText, language);
            }

            // 创建并显示webview面板
            const panel = vscode.window.createWebviewPanel(
                'nameCraftSuggestions',
                'NameCraft 智能建议',
                vscode.ViewColumn.Beside,
                {
                    enableScripts: true,
                    retainContextWhenHidden: true
                }
            );

            // 设置webview内容
            panel.webview.html = getWebviewContent(suggestions, selectedText, hasPlaceholder, targetPlaceholder);

            // 处理webview消息
            panel.webview.onDidReceiveMessage(
                async message => {
                    switch (message.command) {
                        case 'applySuggestion':
                            if (hasPlaceholder) {
                                // 只替换占位符，不替换整个选中文本
                                const escapedPlaceholder = targetPlaceholder.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
                                const newText = selectedText.replace(new RegExp(`\\b${escapedPlaceholder}\\b`, 'g'), message.suggestion);
                                await editor.edit(editBuilder => {
                                    editBuilder.replace(selection, newText);
                                });
                                vscode.window.showInformationMessage(`已将 ${targetPlaceholder} 替换为: ${message.suggestion}`);
                            } else {
                                // 非占位符模式，替换整个选中文本
                                await editor.edit(editBuilder => {
                                    editBuilder.replace(selection, message.suggestion);
                                });
                                vscode.window.showInformationMessage(`已应用建议: ${message.suggestion}`);
                            }
                            panel.dispose();
                            // 清除预览装饰
                            if (previewDecorationType) {
                                previewDecorationType.dispose();
                                previewDecorationType = undefined;
                            }
                            // 清除选择，让用户感知任务完成
                            editor.selection = new vscode.Selection(selection.end, selection.end);
                            break;
                        case 'previewSuggestion':
                            // hover预览功能
                            if (hasPlaceholder) {
                                await showPlaceholderPreview(editor, selection, selectedText, targetPlaceholder, message.suggestion);
                            } else {
                                await showPreviewDecoration(editor, selection, selectedText, message.suggestion);
                            }
                            break;
                    }
                },
                undefined,
                context.subscriptions
            );

        } catch (error) {
            console.error('智能命名失败:', error);
            vscode.window.showErrorMessage(`智能命名失败: ${error}`);
        }
    }

    // 生成webview HTML内容
    function getWebviewContent(suggestions: string[], originalText: string, hasPlaceholder: boolean, targetPlaceholder: string = ''): string {
        const suggestionItems = suggestions.map((suggestion, index) => `
            <div class="suggestion-item" 
                 onmouseover="previewSuggestion('${suggestion}')" 
                 onclick="applySuggestion('${suggestion}')">
                <div class="suggestion-text">${suggestion}</div>
                <div class="suggestion-index">建议 ${index + 1}</div>
            </div>
        `).join('');

        return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>NameCraft 智能建议</title>
    <style>
        body {
            font-family: var(--vscode-font-family);
            padding: 16px;
            margin: 0;
            background-color: var(--vscode-editor-background);
            color: var(--vscode-editor-foreground);
        }
        .header {
            margin-bottom: 16px;
            padding-bottom: 12px;
            border-bottom: 1px solid var(--vscode-widget-border);
        }
        .original-text {
            font-weight: bold;
            color: var(--vscode-textLink-foreground);
            font-size: 14px;
        }
        .subtitle {
            font-size: 12px;
            color: var(--vscode-descriptionForeground);
            margin-top: 4px;
        }
        .suggestions-container {
            display: flex;
            flex-direction: column;
            gap: 8px;
        }
        .suggestion-item {
            padding: 12px;
            background-color: var(--vscode-list-hoverBackground);
            border: 1px solid var(--vscode-widget-border);
            border-radius: 4px;
            cursor: pointer;
            transition: all 0.2s ease;
        }
        .suggestion-item:hover {
            background-color: var(--vscode-list-activeSelectionBackground);
            border-color: var(--vscode-focusBorder);
            transform: translateY(-1px);
            box-shadow: 0 2px 8px rgba(0,0,0,0.15);
        }
        .suggestion-text {
            font-family: var(--vscode-editor-font-family);
            font-size: 16px;
            font-weight: 600;
            margin-bottom: 4px;
        }
        .suggestion-index {
            font-size: 11px;
            color: var(--vscode-descriptionForeground);
        }
    </style>
</head>
<body>
    <div class="header">
        <div class="original-text">原文本: ${originalText}</div>
        <div class="subtitle">${hasPlaceholder ? `点击选择替换占位符 "${targetPlaceholder}"` : '点击选择命名建议'}</div>
    </div>
    <div class="suggestions-container">
        ${suggestionItems}
    </div>

    <script>
        const vscode = acquireVsCodeApi();
        
        function applySuggestion(suggestion) {
            vscode.postMessage({
                command: 'applySuggestion',
                suggestion: suggestion
            });
        }
        
        function previewSuggestion(suggestion) {
            vscode.postMessage({
                command: 'previewSuggestion',
                suggestion: suggestion
            });
        }
    </script>
</body>
</html>`;
    }

    // 预览装饰功能
    let previewDecorationType: vscode.TextEditorDecorationType | undefined;
    
    async function showPreviewDecoration(editor: vscode.TextEditor, selection: vscode.Selection, _originalText: string, suggestion: string) {
        // 清除之前的装饰
        if (previewDecorationType) {
            previewDecorationType.dispose();
        }

        // 创建新的装饰类型
        previewDecorationType = vscode.window.createTextEditorDecorationType({
            backgroundColor: 'rgba(255, 255, 0, 0.2)',
            border: '1px solid rgba(255, 255, 0, 0.8)',
            after: {
                contentText: ` → ${suggestion}`,
                color: 'rgba(0, 255, 0, 0.8)',
                fontStyle: 'italic'
            }
        });

        // 应用装饰
        editor.setDecorations(previewDecorationType, [selection]);
    }

    // 占位符预览功能 - 只高亮占位符部分
    async function showPlaceholderPreview(editor: vscode.TextEditor, selection: vscode.Selection, selectedText: string, targetPlaceholder: string, suggestion: string) {
        // 清除之前的装饰
        if (previewDecorationType) {
            previewDecorationType.dispose();
        }

        // 找到选中文本中所有占位符的位置
        const escapedPlaceholder = targetPlaceholder.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const placeholderRegex = new RegExp(`\\b${escapedPlaceholder}\\b`, 'g');
        const matches = Array.from(selectedText.matchAll(placeholderRegex));
        const decorations: vscode.DecorationOptions[] = [];

        // 为每个占位符创建装饰
        matches.forEach(match => {
            if (match.index !== undefined) {
                const startPos = editor.document.positionAt(
                    editor.document.offsetAt(selection.start) + match.index
                );
                const endPos = editor.document.positionAt(
                    editor.document.offsetAt(selection.start) + match.index + targetPlaceholder.length
                );
                
                decorations.push({
                    range: new vscode.Range(startPos, endPos),
                    renderOptions: {
                        after: {
                            contentText: ` → ${suggestion}`,
                            color: 'rgba(0, 255, 0, 0.9)',
                            fontStyle: 'italic',
                            fontWeight: 'bold'
                        }
                    }
                });
            }
        });

        // 创建新的装饰类型
        previewDecorationType = vscode.window.createTextEditorDecorationType({
            backgroundColor: 'rgba(100, 149, 237, 0.3)',
            border: '1px solid rgba(100, 149, 237, 0.8)',
            borderRadius: '2px'
        });

        // 应用装饰到所有占位符位置
        editor.setDecorations(previewDecorationType, decorations);
    }

    // 注册自定义快捷键
    const customKeybindings = vscode.workspace.getConfiguration('namecraft').get<Record<string, string>>('customKeybindings', {});
    const customCommands: vscode.Disposable[] = [];
    
    Object.entries(customKeybindings).forEach(([key, style]) => {
        const commandId = `namecraft.custom.${key.replace(/[^a-zA-Z0-9]/g, '')}`;
        
        const customCommand = vscode.commands.registerCommand(commandId, async () => {
            if (!checkApiKey()) return;
            
            const editor = vscode.window.activeTextEditor;
            if (!editor) {
                vscode.window.showErrorMessage('请先打开一个文件');
                return;
            }

            const selection = editor.selection;
            const selectedText = editor.document.getText(selection);

            if (!selectedText) {
                vscode.window.showErrorMessage('请先选中一些文本');
                return;
            }

            await quickTransform(selectedText, style, editor, selection);
        });
        
        customCommands.push(customCommand);
    });

    // 监听配置变化，动态更新快捷键
    const configChangeListener = vscode.workspace.onDidChangeConfiguration(event => {
        if (event.affectsConfiguration('namecraft.customKeybindings')) {
            vscode.window.showInformationMessage('自定义快捷键配置已更新，请重启VSCode使其生效');
        }
    });

    // 注册命令
    context.subscriptions.push(
        configureApiKeyCommand,
        quickNamingCommand,
        translateSelectionCommand,
        smartNamingCommand,
        configChangeListener,
        ...quickCommands,
        ...customCommands
    );
}

export function deactivate() {
    console.log('NameCraft 插件已停用');
}