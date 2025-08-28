import * as vscode from 'vscode';
import { TranslationService } from './translationService';
import { NamingGenerator } from './namingGenerator';

export function activate(context: vscode.ExtensionContext) {
    console.log('NameCraft 插件已激活');

    const translationService = new TranslationService();
    const namingGenerator = new NamingGenerator();

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

    // F2 智能替换为驼峰命名命令
    const quickReplaceCommand = vscode.commands.registerCommand('namecraft.quickReplace', async () => {
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

        await quickReplace(selectedText, editor, selection);
    });

    // 处理命名逻辑 - 渐进式交互
    async function processNaming(input: string, editor: vscode.TextEditor) {
        try {
            await vscode.window.withProgress({
                location: vscode.ProgressLocation.Notification,
                title: '正在生成智能命名建议...',
                cancellable: false
            }, async (progress) => {
                progress.report({ increment: 30, message: '调用翻译服务...' });
                
                // Step 1: 获取翻译结果
                const translationResults = await translationService.translate(input);
                
                if (translationResults.length === 0) {
                    vscode.window.showWarningMessage('翻译服务暂不可用，请稍后重试');
                    return;
                }

                progress.report({ increment: 40, message: '生成智能推荐...' });
                
                // 使用翻译结果生成智能推荐（3-5个选项）
                const context = editor.document.fileName;
                const smartRecommendations = namingGenerator.generateSmartRecommendations(translationResults, context);

                progress.report({ increment: 20, message: '准备选择列表...' });
                
                // 创建会话上下文，避免重复翻译
                const sessionContext = {
                    originalInput: input,
                    translationResults,
                    translatedText: translationResults[0].text,
                    smartRecommendations,
                    context
                };

                // 开始智能推荐流程
                await showInitialRecommendations(sessionContext, editor);
            });
        } catch (error) {
            console.error('命名生成失败:', error);
            vscode.window.showErrorMessage(`命名生成失败: ${error}`);
        }
    }

    // 显示初始智能推荐
    async function showInitialRecommendations(sessionContext: any, editor: vscode.TextEditor) {
        const quickPickItems = [
            ...sessionContext.smartRecommendations.map((rec: any) => ({
                label: rec.result,
                description: rec.name,
                detail: rec.description,
                data: rec
            })),
            {
                label: '$(list-unordered) 查看所有96种命名方式',
                description: '更多选项',
                detail: '查看完整的命名选项列表',
                data: null
            }
        ];

        const selected = await vscode.window.showQuickPick(quickPickItems, {
            placeHolder: '选择一个命名建议（前5个为智能推荐）',
            matchOnDescription: true,
            matchOnDetail: true
        });

        if (!selected) return;

        // 如果选择了具体的命名，直接插入
        if (selected.data) {
            await insertNaming(editor, selected.label);
            await askToSaveRule(selected.data);
            return;
        }

        // Step 2: 显示所有96种命名方式（分类显示）
        await showAllNamingOptionsWithContext(sessionContext, editor);
    }

    // Step 2: 显示所有命名选项 - 带会话上下文的版本
    async function showAllNamingOptionsWithContext(sessionContext: any, editor: vscode.TextEditor) {
        const { categories } = namingGenerator.generateAllOptions(sessionContext.translatedText);
        
        // 开始分层导航
        await showCategorySelectionWithContext(categories, sessionContext, editor);
    }

    // Step 2: 显示所有命名选项 - 改进的分层导航（兼容版本）
    async function showAllNamingOptions(translatedText: string, editor: vscode.TextEditor) {
        const { categories } = namingGenerator.generateAllOptions(translatedText);
        
        // 开始分层导航
        await showCategorySelection(categories, translatedText, editor);
    }

    // 显示分类选择（第一层）- 带会话上下文版本
    async function showCategorySelectionWithContext(categories: Record<string, any[]>, sessionContext: any, editor: vscode.TextEditor): Promise<void> {
        const categoryItems = [
            // 返回智能推荐的选项
            {
                label: '$(arrow-left) 返回智能推荐',
                description: '回到前5个智能推荐选项',
                detail: '返回上一步',
                isBack: true
            },
            // 分隔符
            {
                label: '$(dash) 所有命名类型',
                description: '96种命名方式',
                detail: '',
                isSeparator: true
            },
            // 各个分类
            ...Object.keys(categories).map(category => ({
                label: `$(folder) ${category}`,
                description: `${categories[category].length} 个选项`,
                detail: categories[category].map(opt => opt.result).slice(0, 3).join(', ') + '...',
                category,
                isBack: false,
                isSeparator: false
            }))
        ];

        const selectedCategory = await vscode.window.showQuickPick(categoryItems, {
            placeHolder: '选择变量类型分类 (可返回上一步)',
            matchOnDescription: true
        });

        if (!selectedCategory) return;

        // 如果选择返回，重新显示智能推荐
        if (selectedCategory.isBack) {
            await showInitialRecommendations(sessionContext, editor);
            return;
        }

        // 如果是分隔符，忽略
        if (selectedCategory.isSeparator) {
            return showCategorySelectionWithContext(categories, sessionContext, editor);
        }

        // 显示选中分类的选项
        if ('category' in selectedCategory) {
            await showCategoryOptionsWithContext(categories[selectedCategory.category], selectedCategory.category, categories, sessionContext, editor);
        }
    }

    // 显示分类选择（第一层）- 兼容版本
    async function showCategorySelection(categories: Record<string, any[]>, translatedText: string, editor: vscode.TextEditor): Promise<void> {
        const categoryItems = [
            // 返回智能推荐的选项
            {
                label: '$(arrow-left) 返回智能推荐',
                description: '回到前5个智能推荐选项',
                detail: '返回上一步',
                isBack: true
            },
            // 分隔符
            {
                label: '$(dash) 所有命名类型',
                description: '96种命名方式',
                detail: '',
                isSeparator: true
            },
            // 各个分类
            ...Object.keys(categories).map(category => ({
                label: `$(folder) ${category}`,
                description: `${categories[category].length} 个选项`,
                detail: categories[category].map(opt => opt.result).slice(0, 3).join(', ') + '...',
                category,
                isBack: false,
                isSeparator: false
            }))
        ];

        const selectedCategory = await vscode.window.showQuickPick(categoryItems, {
            placeHolder: '选择变量类型分类 (可返回上一步)',
            matchOnDescription: true
        });

        if (!selectedCategory) return;

        // 如果选择返回，重新显示智能推荐
        if (selectedCategory.isBack) {
            // 重新创建简化的会话上下文
            const sessionContext = {
                translatedText,
                smartRecommendations: [], // 需要重新生成
                context: editor.document.fileName
            };
            await showSmartRecommendations(sessionContext.smartRecommendations, editor, translatedText);
            return;
        }

        // 如果是分隔符，忽略
        if (selectedCategory.isSeparator) {
            return showCategorySelection(categories, translatedText, editor);
        }

        // 显示选中分类的选项
        if ('category' in selectedCategory) {
            await showCategoryOptions(categories[selectedCategory.category], selectedCategory.category, categories, translatedText, editor);
        }
    }

    // 显示分类内的选项（第二层）- 带会话上下文版本
    async function showCategoryOptionsWithContext(options: any[], categoryName: string, allCategories: Record<string, any[]>, sessionContext: any, editor: vscode.TextEditor): Promise<void> {
        const optionItems = [
            // 返回分类选择
            {
                label: '$(arrow-left) 返回分类选择',
                description: '选择其他变量类型',
                detail: '',
                isBack: true
            },
            // 分隔符
            {
                label: `$(dash) ${categoryName} 类型命名`,
                description: `${options.length} 个选项`,
                detail: '',
                isSeparator: true
            },
            // 具体选项
            ...options.map(option => ({
                label: option.result,
                description: option.name,
                detail: option.description,
                option,
                isBack: false,
                isSeparator: false
            }))
        ];

        const selectedOption = await vscode.window.showQuickPick(optionItems, {
            placeHolder: `选择 ${categoryName} 类型的命名方式 (可返回上一层)`,
            matchOnDescription: true,
            matchOnDetail: true
        });

        if (!selectedOption) return;

        // 如果选择返回，回到分类选择
        if (selectedOption.isBack) {
            return showCategorySelectionWithContext(allCategories, sessionContext, editor);
        }

        // 如果是分隔符，忽略
        if (selectedOption.isSeparator) {
            return showCategoryOptionsWithContext(options, categoryName, allCategories, sessionContext, editor);
        }

        // 选择了具体选项
        if ('option' in selectedOption && selectedOption.option) {
            await insertNaming(editor, selectedOption.label);
            await askToSaveRule(selectedOption.option);
        }
    }

    // 显示分类内的选项（第二层）- 兼容版本
    async function showCategoryOptions(options: any[], categoryName: string, allCategories: Record<string, any[]>, translatedText: string, editor: vscode.TextEditor): Promise<void> {
        const optionItems = [
            // 返回分类选择
            {
                label: '$(arrow-left) 返回分类选择',
                description: '选择其他变量类型',
                detail: '',
                isBack: true
            },
            // 分隔符
            {
                label: `$(dash) ${categoryName} 类型命名`,
                description: `${options.length} 个选项`,
                detail: '',
                isSeparator: true
            },
            // 具体选项
            ...options.map(option => ({
                label: option.result,
                description: option.name,
                detail: option.description,
                option,
                isBack: false,
                isSeparator: false
            }))
        ];

        const selectedOption = await vscode.window.showQuickPick(optionItems, {
            placeHolder: `选择 ${categoryName} 类型的命名方式 (可返回上一层)`,
            matchOnDescription: true,
            matchOnDetail: true
        });

        if (!selectedOption) return;

        // 如果选择返回，回到分类选择
        if (selectedOption.isBack) {
            return showCategorySelection(allCategories, translatedText, editor);
        }

        // 如果是分隔符，忽略
        if (selectedOption.isSeparator) {
            return showCategoryOptions(options, categoryName, allCategories, translatedText, editor);
        }

        // 选择了具体选项
        if ('option' in selectedOption && selectedOption.option) {
            await insertNaming(editor, selectedOption.label);
            await askToSaveRule(selectedOption.option);
        }
    }

    // 重新显示智能推荐（用于返回功能）
    async function showSmartRecommendations(smartRecommendations: any[], editor: vscode.TextEditor, translatedText: string) {
        const quickPickItems = [
            ...smartRecommendations.map(rec => ({
                label: rec.result,
                description: rec.name,
                detail: rec.description,
                data: rec
            })),
            {
                label: '$(list-unordered) 查看所有96种命名方式',
                description: '更多选项',
                detail: '查看完整的命名选项列表',
                data: null
            }
        ];

        const selected = await vscode.window.showQuickPick(quickPickItems, {
            placeHolder: '选择一个命名建议（前5个为智能推荐）',
            matchOnDescription: true,
            matchOnDetail: true
        });

        if (!selected) return;

        // 如果选择了具体的命名，直接插入
        if (selected.data) {
            await insertNaming(editor, selected.label);
            await askToSaveRule(selected.data);
            return;
        }

        // 重新进入分层选择
        await showAllNamingOptions(translatedText, editor);
    }

    // 插入命名到编辑器
    async function insertNaming(editor: vscode.TextEditor, naming: string) {
        await editor.edit(editBuilder => {
            const position = editor.selection.active;
            editBuilder.insert(position, naming);
        });
        vscode.window.showInformationMessage(`已插入命名：${naming}`);
    }

    // Step 3: 询问是否保存为常用规则
    async function askToSaveRule(namingOption: any) {
        const saveRule = await vscode.window.showInformationMessage(
            `是否将此命名规则保存为常用规则？`,
            { detail: `${namingOption.description}` },
            '保存到快捷键',
            '不保存'
        );

        if (saveRule === '保存到快捷键') {
            await selectShortcutKey(namingOption);
        }
    }

    // 选择快捷键槽位
    async function selectShortcutKey(namingOption: any) {
        const config = vscode.workspace.getConfiguration('namecraft');
        const customRules = config.get('customRules', {}) as Record<string, any>;

        const shortcuts = [
            { label: 'Alt+1', key: 'alt1', current: customRules.alt1?.name || '未设置' },
            { label: 'Alt+2', key: 'alt2', current: customRules.alt2?.name || '未设置' },
            { label: 'Alt+3', key: 'alt3', current: customRules.alt3?.name || '未设置' },
            { label: 'Alt+4', key: 'alt4', current: customRules.alt4?.name || '未设置' },
            { label: 'Alt+5', key: 'alt5', current: customRules.alt5?.name || '未设置' }
        ];

        const selectedShortcut = await vscode.window.showQuickPick(
            shortcuts.map(s => ({
                label: s.label,
                description: `当前: ${s.current}`,
                detail: s.current === '未设置' ? '空槽位' : '将覆盖现有规则',
                key: s.key
            })),
            {
                placeHolder: '选择要绑定的快捷键',
                matchOnDescription: true
            }
        );

        if (selectedShortcut) {
            // 保存自定义规则
            customRules[selectedShortcut.key] = {
                name: namingOption.name,
                style: namingOption.style,
                type: namingOption.type,
                description: namingOption.description
            };

            await config.update('customRules', customRules, vscode.ConfigurationTarget.Global);
            vscode.window.showInformationMessage(`已将规则保存到 ${selectedShortcut.label}`);
        }
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

    // F2 快速替换函数
    async function quickReplace(text: string, editor: vscode.TextEditor, selection: vscode.Selection) {
        try {
            let result: string = '';
            
            // 如果是中文，直接调用AI转换为驼峰
            if (/[\u4e00-\u9fa5]/.test(text)) {
                result = await vscode.window.withProgress({
                    location: vscode.ProgressLocation.Notification,
                    title: '正在智能转换...',
                    cancellable: false
                }, async (progress) => {
                    progress.report({ increment: 100, message: 'AI智能转换中...' });
                    
                    return await translationService.translateToCamelCase(text);
                });
            } else {
                // 如果是英文，使用现有逻辑转换为驼峰
                const recommendations = namingGenerator.generateSmartRecommendations([{text, confidence: 1, service: 'default'}]);
                const camelCaseNaming = recommendations.find(rec => rec.style === 'camelCase') || recommendations[0];
                result = camelCaseNaming.result;
            }
            
            // 替换选中的文本
            await editor.edit(editBuilder => {
                editBuilder.replace(selection, result);
            });
            
            // 显示转换结果
            const message = /[\u4e00-\u9fa5]/.test(text) 
                ? `已转换：${text} → ${result}` 
                : `已转换为驼峰：${result}`;
            vscode.window.showInformationMessage(message);
            
        } catch (error) {
            console.error('F2快速替换失败:', error);
            vscode.window.showErrorMessage(`转换失败: ${error}`);
        }
    }

    // 快速转换函数
    async function quickTransform(text: string, defaultStyle: string, editor: vscode.TextEditor, selection: vscode.Selection) {
        try {
            // 检查是否有自定义规则
            const config = vscode.workspace.getConfiguration('namecraft');
            const customRules = config.get('customRules', {}) as Record<string, any>;
            
            // 根据快捷键找到对应的自定义规则
            const keyMap = {
                'camelCase': 'alt1',
                'PascalCase': 'alt2', 
                'snake_case': 'alt3',
                '_snake_case': 'alt4',
                'CONSTANT_CASE': 'alt5'
            };
            
            const customRuleKey = keyMap[defaultStyle as keyof typeof keyMap];
            const customRule = customRules[customRuleKey];
            
            // 如果是中文，先翻译
            if (/[\u4e00-\u9fa5]/.test(text)) {
                const translationResults = await translationService.translate(text);
                if (translationResults.length > 0) {
                    text = translationResults[0].text;
                }
            }

            let result: string;
            let description: string;

            if (customRule) {
                // 使用自定义规则
                const type = namingGenerator.getVariableType(customRule.type);
                result = namingGenerator.generateSpecificNaming(text, customRule.style, type);
                description = `使用自定义规则：${customRule.name}`;
            } else {
                // 使用默认规则
                const recommendations = namingGenerator.generateSmartRecommendations([{text, confidence: 1, service: 'default'}]);
                const targetNaming = recommendations.find(rec => rec.style === defaultStyle) || recommendations[0];
                result = targetNaming.result;
                description = `默认${defaultStyle}格式`;
            }
            
            // 替换选中的文本
            await editor.edit(editBuilder => {
                editBuilder.replace(selection, result);
            });
            vscode.window.showInformationMessage(`已转换：${result} (${description})`);
            
        } catch (error) {
            console.error('快速转换失败:', error);
            vscode.window.showErrorMessage(`转换失败: ${error}`);
        }
    }

    // 注册命令
    context.subscriptions.push(
        quickNamingCommand,
        translateSelectionCommand,
        quickReplaceCommand,
        ...quickCommands
    );
}

export function deactivate() {
    console.log('NameCraft 插件已停用');
}