export interface ValidationResult {
    isValid: boolean;
    errors: string[];
}

export class ScriptFormatValidator {
    /**
     * 验证脚本格式的完整性和正确性
     */
    validateScript(content: string): ValidationResult {
        const errors: string[] = [];

        // 1. 验证必需的元数据字段
        this.validateMetadata(content, errors);

        // 2. 验证场景格式
        this.validateScenes(content, errors);

        return {
            isValid: errors.length === 0,
            errors
        };
    }

    private validateMetadata(content: string, errors: string[]): void {
        // 首先检查是否有 "输出格式严格如下" 这一行
        if (!content.includes('输出格式严格如下')) {
            errors.push('缺少必需的格式声明行: "输出格式严格如下"');
        }

        const requiredMetadata = [
            { key: '历史时期:', name: '历史时期' },
            { key: '人物特征:', name: '人物特征' },
            { key: '基础画面风格:', name: '基础画面风格' }
        ];

        // 检查 "输出格式严格如下" 后是否跟着所有必需字段
        const formatSectionMatch = content.match(/输出格式严格如下[\s\S]*?(?=场景1:|$)/);
        if (formatSectionMatch) {
            const formatSection = formatSectionMatch[0];
            
            for (const metadata of requiredMetadata) {
                if (!formatSection.includes(metadata.key)) {
                    errors.push(`"输出格式严格如下" 部分缺少字段模板: ${metadata.name}`);
                }
            }
        }

        // 检查实际内容中的字段
        for (const metadata of requiredMetadata) {
            const regex = new RegExp(`${metadata.key}\\s*(.+)`, 'i');
            const match = content.match(regex);
            
            if (!match) {
                errors.push(`缺少必需字段: ${metadata.name}`);
            } else {
                const value = match[1].trim();
                if (!value || value === '' || value === '[]') {
                    errors.push(`${metadata.name} 字段不能为空`);
                }
            }
        }
    }

    private validateScenes(content: string, errors: string[]): void {
        // 匹配所有场景
        const sceneMatches = content.match(/场景\d+:[\s\S]*?(?=场景\d+:|$)/g);
        
        if (!sceneMatches || sceneMatches.length === 0) {
            errors.push('未找到任何场景，请使用 "场景1:", "场景2:" 等格式');
            return;
        }

        // 验证每个场景的完整性
        for (let i = 0; i < sceneMatches.length; i++) {
            const sceneText = sceneMatches[i].trim();
            const sceneNumber = i + 1;
            
            this.validateSingleScene(sceneText, sceneNumber, errors);
        }
    }

    private validateSingleScene(sceneText: string, sceneNumber: number, errors: string[]): void {
        const requiredSceneFields = [
            { key: '描述:', name: '描述' },
            { key: '解说词:', name: '解说词' },
            { key: '视觉提示:', name: '视觉提示' },
            { key: '时长:', name: '时长' }
        ];

        for (const field of requiredSceneFields) {
            const regex = new RegExp(`${field.key}\\s*(.+)`, 'i');
            const match = sceneText.match(regex);
            
            if (!match) {
                errors.push(`场景${sceneNumber} 缺少必需字段: ${field.name}`);
            } else {
                const value = match[1].trim();
                if (!value) {
                    errors.push(`场景${sceneNumber} 的 ${field.name} 字段不能为空`);
                }

                // 验证时长格式（可以是数字或变量格式）
                if (field.key === '时长:') {
                    // 允许的格式：纯数字、[变量]、{变量}、${变量}
                    const validDurationFormats = [
                        /^\d+$/,                    // 纯数字：5, 10
                        /^\[.+\]$/,                 // [变量]：[5-10]
                        /^\{.+\}$/,                 // {变量}：{5-10}
                        /^\$\{.+\}$/                // ${变量}：${duration}
                    ];
                    
                    const isValidFormat = validDurationFormats.some(pattern => 
                        pattern.test(value)
                    );
                    
                    if (!isValidFormat) {
                        errors.push(`场景${sceneNumber} 时长格式不正确，支持格式：数字、[变量]、{变量}、\${变量}`);
                    }
                }
            }
        }
    }
}
