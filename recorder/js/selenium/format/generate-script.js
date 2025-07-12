const generateScriptOutput = ((document) => {
    
    if (!document) {
        alert("Document Object is missing !");
    }

    async function generateScriptOutput({ test_cases: testCases, suite_name }, language) {
        const allCommands = getAllTestCasesCommands(testCases);
        return await loadScripts(allCommands, language, suite_name);
    }
    
    const getAllTestCasesCommands = (testCases) => {
        const commands = testCases.reduce((allCommands, testCase) => {
            if (!testCase || !testCase.commands || !testCase.commands.length) {
                return allCommands;
            }
    
            const testCaseComment = {
                command: 'comment',
                value: 'Label: ' + testCase.testStep
            };
    
            return [
                ...allCommands,
                testCaseComment,
                ...testCase.commands
            ]
        }, []);
    
        return commands;
    };
    
    function ln(line) {
        return "\r\n" + line;
    }
    
    function getCommandsToGenerateScripts(suiteCommands) {
        return suiteCommands.map(function(command) {
           return new Command(command.command, command.target, command.value);
        });
    
    }

    async function loadScriptsInDom (scriptNames, s_suite, language, suite_name) {
        const scriptPromises = scriptNames.map((src, i) => {
            return new Promise((resolve, reject) => {
                const script = document.createElement('script');
                script.id = `formatter-script-language-id-${language}-${suite_name}-${i}`;
                script.src = src;
                script.async = false;
                script.onload = () => resolve();
                script.onerror = () => reject(new Error(`Failed to load script: ${src}`));
                document.head.appendChild(script);
            })
        });
        
       // wait for all scripts to load
       await Promise.allSettled(scriptPromises);

       // Generate the script after all scripts are loaded
       return generateScript(s_suite, suite_name);
    }

    
    
    async function loadScripts(s_suite, language, suite_name) {
        let scriptNames = [];
        switch (language) {
            case 'cs-wd-nunit':
                scriptNames = [
                    '../js/selenium/format/formatCommandOnlyAdapter.js',
                    '../js/selenium/format/remoteControl.js',
                    '../js/selenium/format/csharp/cs-rc.js',
                    '../js/selenium/format/webdriver.js',
                    '../js/selenium/format/csharp/cs-wd.js'
                ];
                break;
            case 'cs-wd-mstest':
                scriptNames = [
                    '../js/selenium/format/formatCommandOnlyAdapter.js',
                    '../js/selenium/format/remoteControl.js',
                    '../js/selenium/format/csharp/cs-rc.js',
                    '../js/selenium/format/webdriver.js',
                    '../js/selenium/format/csharp/cs-wd.js',
                    '../js/selenium/format/csharp/cs-mstest-wd.js'
                ];
                break;
            case 'java-wd-testng':
                scriptNames = [
                    '../js/selenium/format/formatCommandOnlyAdapter.js',
                    '../js/selenium/format/remoteControl.js',
                    '../js/selenium/format/java/java-rc.js',
                    '../js/selenium/format/java/java-rc-junit4.js',
                    '../js/selenium/format/java/java-rc-testng.js',
                    '../js/selenium/format/webdriver.js',
                    '../js/selenium/format/java/webdriver-testng.js'
                ];
                break;
            case 'java-wd-junit':
                scriptNames = [
                    '../js/selenium/format/formatCommandOnlyAdapter.js',
                    '../js/selenium/format/remoteControl.js',
                    '../js/selenium/format/java/java-rc.js',
                    '../js/selenium/format/java/java-rc-junit4.js',
                    '../js/selenium/format/java/java-rc-testng.js',
                    '../js/selenium/format/webdriver.js',
                    '../js/selenium/format/java/webdriver-junit4.js'
                ];
                break;
            case 'java-rc-junit':
                scriptNames = [
                    '../js/selenium/format/formatCommandOnlyAdapter.js',
                    '../js/selenium/format/remoteControl.js',
                    '../js/selenium/format/java/java-rc.js',
                    '../js/selenium/format/java/java-rc-junit4.js',
                    '../js/selenium/format/java/java-rc-testng.js',
                    '../js/selenium/format/java/java-backed-junit4.js'
                ];
                break;
            case 'python-wd-unittest':
                scriptNames = [
                    '../js/selenium/format/formatCommandOnlyAdapter.js',
                    '../js/selenium/format/remoteControl.js',
                    '../js/selenium/format/python/python2-rc.js',
                    '../js/selenium/format/webdriver.js',
                    '../js/selenium/format/python/python2-wd.js'
                ];
                break;
            case 'robot':
                scriptNames = [
                    '../js/selenium/format/formatCommandOnlyAdapter.js',
                    '../js/selenium/format/robot/robot.js'
                ];
                break;
            case 'ruby-wd-rspec':
                scriptNames = [
                    '../js/selenium/format/formatCommandOnlyAdapter.js',
                    '../js/selenium/format/remoteControl.js',
                    '../js/selenium/format/ruby/ruby-rc.js',
                    '../js/selenium/format/ruby/ruby-rc-rspec.js',
                    '../js/selenium/format/webdriver.js',
                    '../js/selenium/format/ruby/ruby-wd-rspec.js'
                ];
                break;
            case 'xml':
                scriptNames = [
                    '../js/selenium/format/formatCommandOnlyAdapter.js',
                    '../js/selenium/format/xml/XML-formatter.js'
                ];
                break;
            default:
                break;
        }
    
        return await loadScriptsInDom(scriptNames, s_suite, language, suite_name);
    }
    
    
    function generateScript(s_suite, suite_name) {
        const testCase = new TestCase();
        testCase.commands = getCommandsToGenerateScripts(s_suite);
        return format(testCase, suite_name);
    }  
    
    return generateScriptOutput;
 })(document);

