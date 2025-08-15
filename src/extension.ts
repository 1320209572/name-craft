import * as vscode from 'vscode';
import { TranslationService } from './translationService';

export function activate(context: vscode.ExtensionContext) {
    console.log('NameCraft 插件已激活');

    const translationService = new TranslationService();

    // 快速命名命令
    const quickNamingCommand = vscode.commands.registerCommand('namecraft.quickNaming', async () => {
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

    // 处理命名逻辑
    async function processNaming(input: string, editor: vscode.TextEditor) {
        try {
            await vscode.window.withProgress({
                location: vscode.ProgressLocation.Notification,
                title: '正在生成命名建议...',
                cancellable: false
            }, async (progress) => {
                progress.report({ increment: 50, message: '调用翻译服务...' });
                
                // 调用后端翻译服务
                const translationResults = await translationService.translate(input);
                
                if (translationResults.length === 0) {
                    vscode.window.showWarningMessage('翻译服务暂不可用，请稍后重试');
                    return;
                }

                progress.report({ increment: 40, message: '生成命名选项...' });
                
                // 直接使用翻译结果，不做额外处理
                const allSuggestions = translationResults.map(translation => ({
                    label: translation.text,
                    description: `评分: ${Math.round(translation.confidence * 100)}`,
                    detail: `来源: ${translation.service}`
                }));

                progress.report({ increment: 10, message: '准备选择列表...' });
                
                if (allSuggestions.length === 0) {
                    vscode.window.showWarningMessage('无法生成命名建议');
                    return;
                }

                // 显示选择列表
                const selected = await vscode.window.showQuickPick(allSuggestions, {
                    placeHolder: '选择一个命名建议',
                    matchOnDescription: true,
                    matchOnDetail: true
                });

                if (selected) {
                    // 插入选中的命名
                    await editor.edit(editBuilder => {
                        const position = editor.selection.active;
                        editBuilder.insert(position, selected.label);
                    });

                    vscode.window.showInformationMessage(`已插入命名：${selected.label}`);
                }
            });
        } catch (error) {
            console.error('命名生成失败:', error);
            vscode.window.showErrorMessage(`命名生成失败: ${error}`);
        }
    }

    // 注册命令
    context.subscriptions.push(
        quickNamingCommand,
        translateSelectionCommand
    );
}

export function deactivate() {
    console.log('NameCraft 插件已停用');
}