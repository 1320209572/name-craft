interface NamingStyle {
    name: string;
    transform: (text: string) => string;
    example: string;
}

interface VariableType {
    id: string;
    name: string;
    prefix: string;
    suffix: string;
    description: string;
    category: string;
}

interface NamingOption {
    id: string;
    name: string;
    result: string;
    style: string;
    type: string;
    description: string;
}

export class NamingGenerator {
    
    // 4种基础命名风格
    private readonly styles: Record<string, NamingStyle> = {
        camelCase: {
            name: '小驼峰',
            transform: (text: string) => this.toCamelCase(text),
            example: 'userName'
        },
        PascalCase: {
            name: '大驼峰',
            transform: (text: string) => this.toPascalCase(text),
            example: 'UserName'
        },
        snake_case: {
            name: '下划线',
            transform: (text: string) => this.toSnakeCase(text),
            example: 'user_name'
        },
        _snake_case: {
            name: '前下划线',
            transform: (text: string) => '_' + this.toSnakeCase(text),
            example: '_user_name'
        }
    };

    // 24种变量类型
    private readonly variableTypes: VariableType[] = [
        // 基础类型
        { id: 'normal', name: '普通变量', prefix: '', suffix: '', description: '一般变量', category: '基础' },
        
        // 作用域类型
        { id: 'global', name: '全局变量', prefix: 'g_', suffix: '', description: '全局作用域变量', category: '作用域' },
        { id: 'static', name: '静态变量', prefix: 's_', suffix: '', description: '静态变量', category: '作用域' },
        { id: 'member', name: 'C++类成员变量', prefix: 'm_', suffix: '', description: 'C++类成员变量', category: '作用域' },
        
        // 特殊用途
        { id: 'const', name: '常量', prefix: '', suffix: '', description: '常量值', category: '用途' },
        { id: 'array', name: '数组', prefix: '', suffix: 'Array', description: '数组变量', category: '用途' },
        { id: 'pointer', name: '指针', prefix: 'p', suffix: '', description: '指针变量', category: '用途' },
        { id: 'function', name: '函数', prefix: '', suffix: '', description: '函数名', category: '用途' },
        { id: 'invalid', name: '无效', prefix: 'invalid', suffix: '', description: '无效值', category: '用途' },
        { id: 'handle', name: '句柄', prefix: 'h', suffix: '', description: '句柄变量', category: '用途' },
        
        // 整数类型
        { id: 'int', name: '整型', prefix: 'n', suffix: '', description: '整数变量', category: '数据类型' },
        { id: 'long', name: '长整型', prefix: 'l', suffix: '', description: '长整数变量', category: '数据类型' },
        { id: 'short', name: '短整型', prefix: 's', suffix: '', description: '短整数变量', category: '数据类型' },
        { id: 'byte', name: '字节', prefix: 'by', suffix: '', description: '字节变量', category: '数据类型' },
        { id: 'word', name: '字', prefix: 'w', suffix: '', description: '字变量', category: '数据类型' },
        { id: 'unsigned', name: '无符号', prefix: 'u', suffix: '', description: '无符号变量', category: '数据类型' },
        
        // 浮点类型
        { id: 'float', name: '浮点型', prefix: 'f', suffix: '', description: '浮点数变量', category: '数据类型' },
        { id: 'double', name: '双精度浮点', prefix: 'd', suffix: '', description: '双精度浮点变量', category: '数据类型' },
        { id: 'real', name: '实型', prefix: 'r', suffix: '', description: '实数变量', category: '数据类型' },
        
        // 其他类型
        { id: 'bool', name: '布尔', prefix: 'b', suffix: '', description: '布尔变量', category: '数据类型' },
        { id: 'string', name: '字符串', prefix: 'str', suffix: '', description: '字符串变量', category: '数据类型' },
        { id: 'char', name: '字符', prefix: 'c', suffix: '', description: '字符变量', category: '数据类型' },
        { id: 'dword', name: '双字', prefix: 'dw', suffix: '', description: '双字变量', category: '数据类型' },
        
        // 语义类型
        { id: 'count', name: '计数', prefix: '', suffix: 'Count', description: '计数变量', category: '语义' }
    ];

    /**
     * 生成智能推荐的命名选项（Step 1）
     * 从翻译结果中选择最佳的3-5个选项
     */
    generateSmartRecommendations(translationResults: any[], context?: string): NamingOption[] {
        const recommendations: NamingOption[] = [];
        
        // 分析上下文，预测最可能的变量类型
        const likelyTypes = this.predictVariableTypes(translationResults[0]?.text || '', context);
        const primaryType = this.variableTypes.find(t => t.id === likelyTypes[0]) || this.variableTypes[0];
        
        // 从翻译结果中选择不重复的高质量选项
        const uniqueTexts = new Set<string>();
        const selectedTranslations: any[] = [];
        
        for (const result of translationResults) {
            const cleanText = this.cleanText(result.text);
            if (!uniqueTexts.has(cleanText.toLowerCase()) && selectedTranslations.length < 5) {
                uniqueTexts.add(cleanText.toLowerCase());
                selectedTranslations.push(result);
            }
        }
        
        // 为选中的翻译结果生成不同风格的命名
        selectedTranslations.slice(0, 3).forEach((translation, index) => {
            const baseText = this.cleanText(translation.text);
            
            // 为每个翻译生成主要的命名风格
            const styles = index === 0 ? ['camelCase', 'PascalCase'] : 
                         index === 1 ? ['snake_case'] : ['camelCase'];
            
            styles.forEach(style => {
                const result = this.generateNaming(baseText, style, primaryType);
                recommendations.push({
                    id: `smart_${recommendations.length}`,
                    name: `${result}`,
                    result,
                    style,
                    type: primaryType.id,
                    description: `${this.styles[style].name} - ${primaryType.description}`
                });
            });
        });
        
        // 确保不超过5个推荐
        return recommendations.slice(0, 5);
    }

    /**
     * 生成所有96种命名选项（Step 2）
     */
    generateAllOptions(translatedText: string): { categories: Record<string, NamingOption[]> } {
        const baseText = this.cleanText(translatedText);
        const categories: Record<string, NamingOption[]> = {};
        
        // 按分类组织所有命名选项
        this.variableTypes.forEach(type => {
            if (!categories[type.category]) {
                categories[type.category] = [];
            }
            
            Object.keys(this.styles).forEach(styleKey => {
                const result = this.generateNaming(baseText, styleKey, type);
                const option: NamingOption = {
                    id: `${type.id}_${styleKey}`,
                    name: `${type.name} - ${this.styles[styleKey].name}`,
                    result,
                    style: styleKey,
                    type: type.id,
                    description: `${type.description} (${result})`
                };
                categories[type.category].push(option);
            });
        });
        
        return { categories };
    }

    /**
     * 生成具体的命名
     */
    private generateNaming(text: string, style: string, type: VariableType): string {
        const styleTransform = this.styles[style];
        let result = styleTransform.transform(text);
        
        // 应用前缀和后缀
        if (type.prefix) {
            if (style === 'camelCase' || style === 'snake_case' || style === '_snake_case') {
                result = type.prefix + result;
            } else { // PascalCase
                result = this.toPascalCase(type.prefix) + result;
            }
        }
        
        if (type.suffix) {
            result = result + type.suffix;
        }
        
        // 常量特殊处理
        if (type.id === 'const') {
            result = result.toUpperCase().replace(/[a-z]/g, '_');
        }
        
        return result;
    }

    /**
     * 基于上下文预测变量类型
     */
    private predictVariableTypes(text: string, context?: string): string[] {
        const predictions: string[] = [];
        
        // 文本内容语义分析
        const semanticRules = [
            // 数量相关
            { patterns: ['count', 'num', 'total', 'size', 'length', '数量', '总数', '大小'], types: ['count', 'int'] },
            // 字符串相关  
            { patterns: ['name', 'title', 'text', 'content', 'message', '名称', '标题', '内容'], types: ['string'] },
            // 布尔相关
            { patterns: ['is', 'has', 'can', 'should', 'will', 'enable', 'visible', '是否'], types: ['bool'] },
            // 集合相关
            { patterns: ['list', 'array', 'items', 'collection', '列表', '数组'], types: ['array'] },
            // 指针相关
            { patterns: ['ptr', 'pointer', 'ref', 'reference'], types: ['pointer'] },
            // 句柄相关
            { patterns: ['handle', 'handler', 'fd', 'descriptor'], types: ['handle'] },
            // 索引相关
            { patterns: ['index', 'idx', 'position', 'pos', '索引', '位置'], types: ['int'] },
            // 常量相关
            { patterns: ['const', 'constant', 'max', 'min', 'default', '常量', '最大', '最小'], types: ['const'] }
        ];

        // 应用语义规则
        const lowerText = text.toLowerCase();
        for (const rule of semanticRules) {
            if (rule.patterns.some(pattern => lowerText.includes(pattern))) {
                predictions.push(...rule.types);
            }
        }

        // 文件类型上下文分析
        if (context) {
            const fileName = context.toLowerCase();
            
            // C/C++ 文件
            if (fileName.includes('.h') || fileName.includes('.cpp') || fileName.includes('.c')) {
                predictions.unshift('member', 'pointer', 'static');
            }
            
            // JavaScript/TypeScript 文件
            if (fileName.includes('.js') || fileName.includes('.ts')) {
                predictions.unshift('normal', 'const');
            }
            
            // Python 文件
            if (fileName.includes('.py')) {
                predictions.unshift('normal');
            }
            
            // Java 文件
            if (fileName.includes('.java')) {
                predictions.unshift('member', 'static');
            }
            
            // 头文件通常包含常量和全局变量
            if (fileName.includes('.h')) {
                predictions.unshift('const', 'global');
            }
        }

        // 词汇长度启发式
        const words = this.splitWords(text);
        if (words.length > 2) {
            predictions.unshift('normal'); // 长描述通常是普通变量
        }

        // 特殊前缀后缀分析
        if (text.startsWith('get') || text.startsWith('set')) {
            predictions.unshift('function');
        }
        
        if (text.endsWith('Count') || text.endsWith('Size')) {
            predictions.unshift('count', 'int');
        }
        
        if (text.endsWith('Flag') || text.endsWith('State')) {
            predictions.unshift('bool');
        }

        // 默认回退
        if (predictions.length === 0) {
            predictions.push('normal');
        }

        // 去重并返回前5个，保持顺序
        return [...new Set(predictions)].slice(0, 5);
    }

    /**
     * 清理翻译文本
     */
    private cleanText(text: string): string {
        return text.trim().replace(/[^\w\s]/g, '');
    }

    /**
     * 转换为小驼峰
     */
    private toCamelCase(text: string): string {
        const words = this.splitWords(text);
        if (words.length === 0) return '';
        return words[0].toLowerCase() + 
               words.slice(1).map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join('');
    }

    /**
     * 转换为大驼峰
     */
    private toPascalCase(text: string): string {
        const words = this.splitWords(text);
        return words.map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join('');
    }

    /**
     * 转换为下划线
     */
    private toSnakeCase(text: string): string {
        const words = this.splitWords(text);
        return words.map(w => w.toLowerCase()).join('_');
    }

    /**
     * 根据类型ID获取变量类型
     */
    getVariableType(typeId: string): VariableType {
        return this.variableTypes.find(t => t.id === typeId) || this.variableTypes[0];
    }

    /**
     * 生成特定类型和风格的命名
     */
    generateSpecificNaming(text: string, style: string, type: VariableType): string {
        return this.generateNaming(text, style, type);
    }

    /**
     * 分割单词
     */
    private splitWords(text: string): string[] {
        // 处理已有的命名格式
        return text
            .replace(/([a-z])([A-Z])/g, '$1 $2') // camelCase -> camel Case
            .replace(/[_-]/g, ' ') // 下划线和连字符替换为空格
            .split(/\s+/)
            .filter(word => word.length > 0);
    }
}