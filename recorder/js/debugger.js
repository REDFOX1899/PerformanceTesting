var manifest = chrome.runtime.getManifest();
var background = chrome.extension.getBackgroundPage();
var backgroundRecorder = background.getRecorder({});

var replayStatus = 'stop';
var pendingSpeedIcon = '/sideex/icons/command-loading.svg';
let positionLeft = 0;
let positionTop = 0;
var replayingWindow = null;

var inspectorCurrentCommandIndex = 0;
var inspectorCurrentTestCaseIndex = 0;

var draggedItemStartIndex = 0;
var draggedItemStopIndex = 0;

var commandList = [];

var commandParameters = null;


/**
 * PlaybackAPI
 *
 * Instantiated in the end, since we need to provide callbacks it will be triggering.
 */
let playback;

var replaySpeeds = [
    {speed: '4000', label: '0.1x'},
    {speed: '1500', label: '0.5x'},
    {speed: '1000', label: 'Normal'},
    {speed: '500', label: '1.5x'},
    {speed: '50', label: '3x'}
];

const YAML = 'yaml';
const CSHARP_WDNUUNIT = 'cs-wd-nunit';
const CSHARP_WDMSTEST = 'cs-wd-mstest';
const JAVA_WDTESTNG = 'java-wd-testng';
const JAVA_WDJUNIT = 'java-wd-junit';
const JAVA_RCJUNIT = 'java-rc-junit';
const PYTHON_WDUNIT = 'python-wd-unittest';
const RUBY_WDRSPEC = 'ruby-wd-rspec';
const xml = 'xml';

const exportScriptNames = {
    [YAML]: {
        fullName: 'Selenium YAML',
        fileFormat: 'yaml',
    },
    [CSHARP_WDNUUNIT]: {
        fullName: 'C# (WebDriver + NUnit)',
        fileFormat: 'cs',
    },
    [CSHARP_WDMSTEST]: {
        fullName: 'C# (WebDriver + MSTest)',
        fileFormat: 'cs',
    },
    [JAVA_WDTESTNG]: {
        fullName: 'Java (WebDriver + TestNG)',
        fileFormat: 'java',
    },
    [JAVA_WDJUNIT]: {
        fullName: 'Java (WebDriver + JUnit)',
        fileFormat: 'java',
    },
    [JAVA_RCJUNIT]: {
        fullName: 'Java (WebDriver-backend Remote Control + JUnit)',
        fileFormat: 'java',
    },
    [PYTHON_WDUNIT]: {
        fullName: 'Python (WebDriver + UnitTest)',
        fileFormat: 'py'
    },
    [RUBY_WDRSPEC]: {
        fullName: 'Ruby (WebDriver + RSpec)',
        fileFormat: 'rb',
    },
    [xml]: {
        fullName: 'XML',
        fileFormat: 'xml',
    },
};

$(document).ready(function () {
    $('#scripts-names-select li').on('click', () => {
        $('body').click();
    });

    loadCommandsDetails().then(result => {
        commandParameters = result.commandParameters;
        commandList = result.commandList;
        registerTab();
        initButtons();
        reloadSuite();
        setInterval(checkMovement, 300);
        checkRecordingStatus();
    });


    addGuideLinkClickedListener();
    actionDropdownOpenerListener();
});

function addGuideLinkClickedListener() {
    var guideLink = $(".footer-right .button_container_question a");
    guideLink.on("click", function() {
    })
}

function loadCommandsDetails() {
    return new Promise(function (resolve, reject) {
        $.getJSON('/sideex/commands-parameters.json', function (data) {
            if (data) {
                let commandList = [];
                for (var k in data) {
                    commandList.push(k);
                }
                let result = {commandParameters: data, commandList: commandList};
                resolve(result);
            } else {
                console.log('Could not found "/sideex/commandParameters.json" file.');
            }
        });
    });
}

function addCommand(command, testCaseIndex, commandIndex, callback) {
    backgroundRecorder.addCommand(testCaseIndex, commandIndex, command);
    if (callback) {
        callback();
    }
}

function updateCommand(commandIndex, testCaseIndex, command) {
    backgroundRecorder.updateCommand(testCaseIndex, commandIndex, command);
}

function updateCommandProperty(commandIndex, testCaseIndex, commandProperty, value) {
    backgroundRecorder.updateCommandProperty(testCaseIndex, commandIndex, commandProperty, value);
}

function updateCommandIndex(testCaseIndex, commandFromIndex, commandToIndex) {
    backgroundRecorder.updateCommandIndex(testCaseIndex, commandFromIndex, commandToIndex);
}

function updateTestCaseName(testCaseIndex, newName) {
    backgroundRecorder.updateTestCaseName(testCaseIndex, newName);
}

function deleteCommand(testCaseIndex, commandIndex) {
    backgroundRecorder.deleteCommmand(testCaseIndex, commandIndex);
}

function addTestCase(testCaseIndex, testCase) {
    backgroundRecorder.addTestCase(testCaseIndex, testCase);
}

function addNewTestCase(name) {
    foldAll();
    backgroundRecorder.addNewTestCase(name);
    unfoldTestCase();
}

function deleteTestCase(testCaseIndex) {
    backgroundRecorder.deleteTestCase(testCaseIndex);
}

function updateSuiteName(name) {
    backgroundRecorder.updateSuiteName(name);
}

function loadSuiteJSON(json) {
    backgroundRecorder.loadSuiteJSON(json);
    reloadSuite();
}

function loadSuite(suite) {
    $('#suite-name').html(suite.suite_name);
    let htmlTestCases = '';
    for (let testCase in suite.test_cases) {
        htmlTestCases += renderTestCaseObject(testCase, suite);
    }
    $('#test-cases').html(htmlTestCases);
    if (suite.test_cases) {
        unfoldTestCase(0);
    }
}

function renderTestCaseObject(testCase, suite) {
    let htmlObject = "<div class=\"test-case\" data-testCaseIndex='" + testCase + "'>\n" +
        "                <div class=\"title\"><div class=\"dropdown-arrow\"><span class='arrow-icon'>&#9654;</span></div><div class='title-content'>\n" +
        "                    <div class=\"name\"><span class='label teststep-name'>\n" +
        '                       ' + suite.test_cases[testCase].testStep +
        "                    </span><input type='text' class='teststep-name-edit'></div>\n" +
        '                </div><i class="fa fa-plus" title="Add command"></i></div>\n' +
        '                <div class="content">\n' +
        '                    <div class="command-container">\n';
    for (let command in suite.test_cases[testCase].commands) {
        htmlObject += renderCommandObject(testCase, command, suite);
    }
    htmlObject += '</div>\n' +
        '                </div>\n' +
        '            </div>\n';
    return htmlObject;
}

function renderCommandObject(testCase, command, suite) {
    let commandName = '', commandTarget = '', commandValue = '', targetOptions = [];
    let commandObject = suite.test_cases[testCase].commands[command];
    if (commandObject.command) {
        commandName = commandObject.command;
        if (commandName === 'click') {
            commandName = 'clickAt';
        }
        if (commandName === 'doubleClick') {
            commandName = 'doubleClickAt';
        }
        if (commandName === 'contextClick') {
            commandName = 'rightClickAt';
        }
    }
    if (commandObject.target) {
        commandTarget = commandObject.target;
    }
    if (commandObject.value) {
        commandValue = commandObject.value;
    }
    if (commandObject.targetOptions) {
        targetOptions = commandObject.targetOptions;
    }

    let breakpoint = isBreakpoint(testCase, command);

    //Enable/disable sortable properties
    let sortable = 'sortable';
    //Enable/disable drag field
    let handle = 'grippy';
    //Enable/disable breakpoint dot
    let activeBreakpoint = breakpoint ? 'active': '';

    let htmlObject;

    let paramValue;
    let paramTarget;
    let paramValueDesc;
    let paramTargetDesc;
    if (commandName && commandName !== 'newcommand') {
        let commandParameters = getCommandParameters(commandName);
        if (commandParameters) {
            paramValue = commandParameters.value ? commandParameters.value.type : null;
            paramTarget = commandParameters.target ? commandParameters.target.type : null;
            paramTargetDesc = commandParameters.target ? commandParameters.target.description : null;
            paramValueDesc = commandParameters.value ? commandParameters.value.description : null;
        }
        else {
            paramValue = 'string';
            paramTarget = 'locator';
            paramTargetDesc = '';
            paramValueDesc = ''
        }
    } else {
        paramValue = undefined;
        paramTarget = undefined;
    }

    //Render command object
    htmlObject = '<div class="command ' + sortable + "\" data-testCaseIndex='" + testCase + "' data-commandIndex='" + command + "'>" +
        "<div class='commmand-actions'><div class='col'><span class=\"" + handle + "\"></span></div><div class='col'><button class='btn-breakpoint" + activeBreakpoint + "'></button><button class='btn-inspect'></button></div></div>" +
        "<div class='command-content'>" +
        "<div class='command-row'>" +
        "<div class=\"name property\" data-property='command'>" + renderCommandProperty(commandName) + '</div>';
    commandValue = commandValue.replace(/&/g, '&amp;').replace(/</g, '&lt;');
    htmlObject += "<div class=\"value property\" data-property='value'>" + renderValueProperty(commandValue, paramValue, paramValueDesc) + '</div></div>';
    htmlObject += "<div class='command-row'><div class=\"target property\" data-property='target'>" +
        renderTargetObject(commandTarget, targetOptions, paramTarget, paramTargetDesc) +
        "</div></div></div><div class='command-status'><img></div></div>";

    return htmlObject;
}

function renderCommandProperty(commandName) {
    let htmlObj;
    if (commandName == 'newcommand') {
        //Add span-placeholder class
        htmlObj = "<span class='label command-property span-placeholder' title='Command name'>Command name</span><input type='text' placeholder='Command name' class='property-edit'>";
    } else {
        htmlObj = "<span class='label command-property' title='" + commandName + "'>" + commandName + "</span><input type='text' class='property-edit'>";
    }
    return htmlObj;
}

function renderValueProperty(commandValue, propertyType, description = 'Value') {
    let htmlObj;
    if (propertyType === 'string') {
        if (commandValue == '') {
            //Add span-placeholder class
            htmlObj = "<span>(</span><span class='command-property span-placeholder' title='" + description + "'>Value</span><input type='text' placeholder='Value' class='property-edit'><span>)</span>";
        } else {
            htmlObj = "<span>(</span><span class='command-property' title='" + description + "'>" + commandValue + "</span><input type='text' class='property-edit'><span>)</span>";
        }
    } else if (propertyType === null) {
        htmlObj = "<span class='command-property hidden' title=''></span><input type='text' placeholder='' class='property-edit'>";
    } else if (propertyType === undefined) {
        htmlObj = "<span class='span-disabled' title='Enter command name'>Value</span><input type='text' disabled placeholder='' class='property-edit'>";
    }
    return htmlObj;
}

function renderTargetObject(target, targetOptions, propertyType, description = 'Target') {
    let htmlObj;

    target = target.replace(/"/g, '&quot;');

    if (propertyType === 'locator') {
        htmlObj = '<div class="select-editable"><select>';
        htmlObj += "<option value=''>Custom</option>";
        let selected = '';
        for (let i = 0; i < targetOptions.length; i++) {
            selected = '';
            let option = targetOptions[i][0];
            if (option === target) {
                selected = 'selected';
            }
            option = option.replace(/"/g, '&quot;');
            htmlObj += '<option value="' + option + '"' + selected + '>' + targetOptions[i][0] + '</option>';
        }
        htmlObj += "</select><input type=\"text\" placeholder='Target' title='" + description + "' class='target-edit' value=\"" + target + '"/></div>';
    } else if (propertyType === 'string') {
        if (target) {
            htmlObj = "<span class='command-property' title='" + description + "'>" + target + '</span>' +
                "<input type='text' placeholder='Target' class='property-edit'>";
        } else {
            htmlObj = "<span class='command-property span-placeholder' title='" + description + "'>Target</span>" +
                "<input type='text' placeholder='Target' class='property-edit'>";
        }
    } else if (propertyType === null) {
        htmlObj = "<span class='command-property hidden' title=''></span>" +
            "<input type='text' placeholder='Target' class='property-edit'>";
    } else if (propertyType === undefined) {
        htmlObj = "<span class='span-disabled' title='Enter command name'>Target</span>" +
            "<input type='text' disabled placeholder='Target' class='property-edit'>";
    }
    return htmlObj;
}

function getCommandParameters(command) {
    try {
        return commandParameters[command];
    } catch (e) {
        return null;
    }
}

function updateCommandStatus(testCaseId, commandId, status) {
    var icon = switchStatusIcon(status);
    let commandObj = $(".command[data-testCaseIndex='" + testCaseId + "'][data-commandIndex='" + commandId + "']");
    unfoldTestCase(testCaseId);
    if (commandObj.length > 0) {
        let imageObj = commandObj.find('.command-status img');
        imageObj.attr('src', icon);
        imageObj.show();
        commandObj.attr('data-status', status);
        $('#test-cases').scrollTop($('#test-cases').scrollTop() + commandObj.position().top - $('#test-cases').height());
    }
}

function updateTestCaseStatus(testCaseId, status) {
    var color = switchStatusIcon(status);
    unfoldTestCase(testCaseId);
    $(".test-case[data-testCaseIndex='" + testCaseId + "'] .title").css({'background': color});
}

function switchStatusIcon(status) {
    let statusIcon = null;
    if (status === 'success') {
        statusIcon = '/sideex/icons/command-pass.png';
    } else if (status === 'fail') {
        statusIcon = '/sideex/icons/command-fail.png';
    } else if (status === 'pending') {
        statusIcon = pendingSpeedIcon;
    }
    return statusIcon;
}

function foldTestCase(testCaseId, callback) {
    let testCaseObj = $(".test-case[data-testCaseIndex='" + testCaseId + "']");
    testCaseObj.find('.title .dropdown-arrow .arrow-icon').css({'transform': 'rotate(0deg)'});
    testCaseObj.removeClass('active');
    testCaseObj.find('.content').slideUp('fast', () => {
        if (callback) callback()
    });
}

function unfoldTestCase(testCaseId, callback) {
    let testCaseObj = $(".test-case[data-testCaseIndex='" + testCaseId + "']");
    testCaseObj.find('.title .dropdown-arrow .arrow-icon').css({'transform': 'rotate(90deg)'});
    testCaseObj.addClass('active');
    testCaseObj.find('.content').slideDown('fast', () => {
        if (callback) callback()
    });
}

function foldAll() {
    $('.test-case').each(function () {
        let testCaseIndex = $(this).attr('data-testcaseindex');
        foldTestCase(testCaseIndex);
    });
}

function unfoldAll() {
    $('.test-case').each(function () {
        let testCaseIndex = $(this).attr('data-testcaseindex');
        unfoldTestCase(testCaseIndex);
    });
}

function enableBtn(btnid) {
    $('#' + btnid).css('display', 'inline-block');
    $('#' + btnid + '-off').hide();
}

function disableBtn(btnid) {
    $('#' + btnid).hide();
    $('#' + btnid + '-off').css('display', 'inline-block');
}

function clearStatus() {
    $('#bottom-bar .status').text('').attr('title', '').removeClass('info').removeClass('success').removeClass('error');
}

function updateStatus(status, type, time) {
    var elemClass = '';
    let content = '';
    if (type === 'error') {
        content = 'ERROR: ';
        elemClass = 'error';
    }
    if (type === 'info') {
        content = 'INFO: ';
        elemClass = 'info';
    }
    if (type === 'success') {
        content = 'SUCCESS: ';
        elemClass = 'success';
    }
    content += status;
    $('#bottom-bar .status').text(content).attr('title', content).removeClass('info').removeClass('success').removeClass('error');
    $('#bottom-bar .status').text(content).addClass(elemClass);
    $('#bottom-bar').show();

    if (time) {
        setTimeout(() => {
            clearStatus();
        }, time);
    }
}

function switchOnReplayStatus(status) {
    if (status) {
        switch (status) {
            case 'stop': {
                $.enableBtn('play');
                $.enableBtn('edit');
                $.disableBtn('pause');
                $.disableBtn('stop');
                break;
            }
            case 'pause': {
                $.disableBtn('pause');
                $.enableBtn('play');
                $.disableBtn('edit');
                break;
            }
            case 'replaying': {
                $.disableBtn('play');
                $.enableBtn('pause');
                $.enableBtn('stop');
                break;
            }
            case 'norecording':
                $.disableBtn('play');
                $.disableBtn('pause');
                $.disableBtn('stop');
                $.disableBtn('speed');
                $.disableBtn('download');
                $.disableDropdownBtn('button-download-yaml-dropdown');
                $.disableDropdownBtn('button-download-json-dropdown');
                // disableBtn('export-json');
        }
    }
}

function initButtons() {
    const spriptNamesValues = Object.keys(exportScriptNames);
    $.enableBtn('play');
    $.enableBtn('pause');
    $.enableBtn('stop');
    $.enableBtn('speed');
    $.enableBtn('download');
    $.enableDropdownBtn('button-download-json-dropdown');
    spriptNamesValues.forEach((scriptNameValue) => {
        const dropdownWrapper = $('#scripts-names-select');
        const scriptNameDropdownElem = document.createElement('li');
        const shadowDropdownElem = document.createElement('li');
        shadowDropdownElem.id = 'shadow';
        scriptNameDropdownElem.id = `button-download-${scriptNameValue}-dropdown`;
        scriptNameDropdownElem.className = 'tooltip-btn';
        scriptNameDropdownElem.title = `Export ${exportScriptNames[scriptNameValue].fullName}`;
        scriptNameDropdownElem.onclick = () => $('body').click();

        const scriptNameTextElem = document.createElement('span');
        scriptNameTextElem.textContent = exportScriptNames[scriptNameValue].fullName;
        $(scriptNameDropdownElem).append(scriptNameTextElem);

        dropdownWrapper.append(scriptNameDropdownElem);
        dropdownWrapper.append(shadowDropdownElem);
        $.enableDropdownBtn(`button-download-${scriptNameValue}-dropdown`);
    });
    $.enableDropdownBtn('button-download-yaml-dropdown');
    $.enableDropdownBtn('button-download-json-dropdown');
    $.disableBtn('edit');
    // enableBtn('export-json');
    $.enableBtn('load');

    checkRecordingStatus();

    $('.version').html(manifest.version);
    // $('#pause').click(pauseReplay);
    $('#play-off').click(pauseReplay);
    $('#play').click(startReplayHandler);
    $('#stop').click(stopReplay);
    spriptNamesValues.forEach((scriptNameValue) => {
        $(`#button-download-${scriptNameValue}-dropdown`).click(function() {
            const format = exportScriptNames[scriptNameValue].fileFormat;
            if (['rb', 'py'].includes(format)) {
                if (window.innerWidth < 730) {
                    window.resizeTo(730, window.outerHeight);
                }
            }
            download_suite_script(scriptNameValue, format);
        });
    });
    $('#button-download-json-dropdown').on('click', e => {
        e.stopPropagation();
        e.preventDefault();
        exportJson();
    });

    $('#button-download-json').click(function () {
        exportJson();
    });
    $('#replayDelay').slider({
        range: 'max',
        min: 1,
        max: 5,
        value: 3,
        slide: function (event, ui) {
            setDelaySpeed(ui.value);
        },
        change: function (event, ui) {
            setDelaySpeed(ui.value);
        },
        stop: function (event, ui) {
            setDelaySpeed(ui.value);
        }
    });
    // $('#speed').click(function () {
    //     let elem = $(this);
    //     let speedIndex = parseInt(elem.attr("data-speed"));
    //     if (speedIndex >= replaySpeeds.length - 1) {
    //         speedIndex = -1;
    //     }
    //     setDelaySpeed(speedIndex + 1);
    // });
    $('#load').click(load);
    $('#fileinput').change(loadfile);
    var $menu = $('#speed-menu');

    $('body').on('click', function (e) {
        if(!($(e.target).hasClass('i-speed'))) {
            $menu.hide();
        }
    });


    // set beautiful tooltips from JQuery-UI for buttons
    $('#play').tooltip();
    $('#play-off').tooltip();
    $('#stop').tooltip();
    $('#stop-off').tooltip();
    $('#speed').tooltip();
    $('#speed-off').tooltip();
    $('#load').tooltip();
    $('#load-off').tooltip();
    $('#button-download-json').tooltip();
    $('#button-download-json-dropdown').tooltip();
    $('#button-download-yaml-dropdown').tooltip();

    $('#speed').click(function () {
        if ($('#speed-menu').is(':visible')) {
            $('#speed-menu').hide();
        } else {
            $('#speed-menu').show();
        }
    });

    $('#speed-1').click(function () {
        setDelaySpeed(0);
        $('.check').remove();
        $('#speed-1').prepend('<i class="fa fa-check check"></i>');
        $('#speed-menu').hide();
    });


    $('#speed-2').click(function () {
        setDelaySpeed(1);
        $('.check').remove();
        $('#speed-2').prepend('<i class="fa fa-check check"></i>');
        $('#speed-menu').hide();
    });

    $('#speed-3').click(function () {
        setDelaySpeed(2);
        $('.check').remove();
        $('#speed-3').prepend('<i class="fa fa-check check"></i>');
        $('#speed-menu').hide();
    });

    $('#speed-4').click(function () {
        setDelaySpeed(3);
        $('.check').remove();
        $('#speed-4').prepend('<i class="fa fa-check check"></i>');
        $('#speed-menu').hide();
    });

    $('#speed-5').click(function () {
        setDelaySpeed(4);
        $('.check').remove();
        $('#speed-5').prepend('<i class="fa fa-check check"></i>');
        $('#speed-menu').hide();
    });
}

function stopReplay() {
    backgroundRecorder.replayStatus = 'stopped';
    // playback.js
    playback.stop();

    // Remove pending status commands
    let failIcon = switchStatusIcon('fail');
    $('.command[data-status="pending"]').find('img').attr('src', failIcon);
    $('.command[data-status="pending"]').attr('data-status', 'fail');

    replayStatus = 'stop';
    switchOnReplayStatus('stop');
    updateStatus('Replay stopped!');

    detachPromptAllTabs();
    chrome.tabs.onActivated.removeListener(tabsOnActivatedHandler);

    closeReplayWindow();
}

function getClickCommandForDownload(command) {
    switch (command) {
        case 'clickAt':
            return 'click';
        case 'doubleClickAt':
            return 'doubleClick';
        case 'contextClickAt':
            return 'contextClick';
        default:
            return command;
    }
}

function getValidatedSuite(suite) {
    return {
        ...suite,
        test_cases: suite.test_cases.map(testCase => ({
            ...testCase,
            commands: testCase.commands.map(command => ({
                ...command,
                command: getClickCommandForDownload(command.command)
            }))
        }))
    };
}

function download_suite_script(language, fileFormat) {
    event.stopPropagation();

    getSuite().then(suite => {
        const validatedSuite = getValidatedSuite(suite);
        downloadSuiteScript(validatedSuite, { language, fileFormat });
    });
}

function exportJson() {
    getExportJsonSuite().then(suite => {
        var blob = new Blob([JSON.stringify(suite)], {type: 'application/json'});
        var url = URL.createObjectURL(blob);
        var link = $('<a></a>');
        link.on('click', e => e.stopPropagation());
        $('body').append(link);
        link.attr('download', $('#suite-name').text() + '-Selenium.json');
        link.attr('href', url);
        link[0].click();
        link.remove();
    });
}

function load() {
    document.getElementById('fileinput').click();
    if (replayStatus != 'stop') {
        playback.stop();
        replayStatus = 'stop';
        switchOnReplayStatus(replayStatus);
    }
}

function loadfile() {
    var file = document.getElementById('fileinput').files[0];
    if (file) {
        // create reader
        var reader = new FileReader();
        reader.readAsText(file);
        reader.onload = function (e) {
            var file_string = e.target.result;
            var json;
            try {
                json = JSON.parse(file_string);
            } catch (ex) {
                // alert('Invalid file');
                updateStatus('Invalid file',  'error', 5000);
                return;
            }
            if (json.suite_name && json.test_cases) {
                backgroundRecorder.loadSuiteJSON(json);
                window.location.reload(true);
            } else {
                updateStatus('Invalid file',  'error', 5000);
                // alert('Invalid file');
            }
        };
    }
}

function setDelaySpeed(delay) {
    // delay = delay - 1;
    let speed = replaySpeeds[delay].speed;
    let speedLabel = replaySpeeds[delay].label;
    playback.replayDelay = speed;

    if (delay == 4) {
        pendingSpeedIcon = '/sideex/icons/command-loading-fast.svg';
    }
    if (delay >= 1 && delay <= 3) {
        pendingSpeedIcon = '/sideex/icons/command-loading.svg';
    }
    if (delay == 0) {
        pendingSpeedIcon = '/sideex/icons/command-loading-slow.svg';
    }

    $(".command[data-status='pending']").find('.command-status').find('img').attr('src', pendingSpeedIcon);

    let elem = $('#speed');
    elem.attr('data-speed', delay);
    if (speedLabel === 'Normal') {
        elem.find('i').removeClass('speed-icon');
        elem.find('i').html('1x');
    } else {
        elem.find('i').removeClass('speed-icon-normal');
        elem.find('i').removeClass('speed-icon');
        elem.find('i').html(speedLabel);
    }

}

function linkEvents() {
    //Unbind elements to avoid duplicated events
    $(document).unbind('click.dropdown-arrow').on('click.dropdown-arrow', '.dropdown-arrow', function () {
        var elem = $(this).closest('.test-case');
        if (!elem.hasClass('active')) {
            let testCaseIndex = elem.attr('data-testCaseIndex');
            unfoldTestCase(testCaseIndex);
        } else {
            let testCaseIndex = elem.attr('data-testCaseIndex');
            foldTestCase(testCaseIndex);
        }
    });
    $(document).unbind('click.command-property').on('click.command-property', '.command-property', function () {
        //Check if not empty property
        let parentWidth = $(this).parent().width();
        // +2 For the writing cursor to show
        let width = $(this).width() + 2;
        if (width > parentWidth) {
            width = parentWidth;
        }
        $(this).hide();
        $(this).next().css({
            'width': width,
            'font-weight': $(this).css('fontWeight'),
            'padding': $(this).css('padding')
        });
        $(this).next().show();
        //If is not empty property
        if (!$(this).hasClass('span-placeholder')) {
            $(this).next().val($(this).text());
        }
        $(this).next().focus();
    });
    $(document).unbind('click.suite-name').on('click.suite-name', '#suite-name', function () {
        let parentWidth = $(this).parent().width();
        // +2 For the writing cursor to show
        let width = $(this).width() + 2;
        if (width > parentWidth) {
            width = parentWidth;
        }
        $(this).hide();
        $(this).next().css({
            'width': width,
            'font-weight': $(this).css('fontWeight'),
            'padding': $(this).css('padding'),
            'font-size': $(this).css('font-size'),
            'color': $(this).css('color')
        });
        $(this).next().show();
        $(this).next().val($(this).text());
        $(this).next().focus();
    });
    $(document).unbind('click.teststep-name').on('click.teststep-name', '.teststep-name', function () {
        // +2 For the writing cursor to show
        let width = $(this).width() + 2;
        $(this).hide();
        $(this).next().css({
            'width': width,
            'font-weight': $(this).css('fontWeight'),
            'padding': $(this).css('padding'),
            'background': $(this).css('background')
        });
        $(this).next().show();
        $(this).next().focus();
        $(this).next().val($(this).text().trim());
    });
    $(document).unbind('click.btn-inspect').on('click.btn-inspect', '.btn-inspect', function () {
        inspectorCurrentCommandIndex = $(this).closest('.command').attr('data-commandindex');
        inspectorCurrentTestCaseIndex = $(this).closest('.command').attr('data-testcaseindex');
        //Open selection on all tabs
        chrome.tabs.query({}, tabs => {
            for (let tab in tabs) {
                if (!tabs[tab].url.startsWith('chrome-extension://') && !tabs[tab].url.startsWith('chrome://')) {
                    // chrome.windows.update(tabs[tab].windowId, {focused: true});
                    chrome.tabs.sendMessage(tabs[tab].id, {selectMode: true, selecting: true}).catch(function (err) {
                    });
                }
            }
            chrome.windows.getCurrent(currentWindows => {
                chrome.windows.update(currentWindows.id, {state: 'minimized'});
            });
            if (!tabs.length) {
                updateStatus('No window active', 'error', 5000);
            }
        });
    });
    $(document).unbind('keyup.suite-name-edit').on('keyup.suite-name-edit', '.suite-name-edit', function (event) {
        if (event.keyCode === 13) {
            //Typing enter commits name change
            updateSuiteName($(this).val());
            $(this).prev().html($(this).val());
            $(this).hide();
            $(this).prev().show();
            $(this).prev().focus();
        } else if (event.keyCode == 27) {
            //Esc cancels the name change
            $(this).hide();
            $(this).prev().show();
            $(this).prev().focus();
        }
    });
    $(document).unbind('focusout.suite-name-edit').on('focusout.suite-name-edit', '.suite-name-edit', function (event) {
        if (event.keyCode == 27) {
            //Esc cancels the name change
            $(this).hide();
            $(this).prev().show();
            $(this).prev().focus();
        } else {
            //Typing enter commits name change
            updateSuiteName($(this).val());
            $(this).prev().html($(this).val());
            $(this).hide();
            $(this).prev().show();
            $(this).prev().focus();
        }

    });
    $(document).unbind('keyup.property-edit').on('keyup.property-edit', '.property-edit', function (event) {
        adjustInputWidth($(this));
        if (event.keyCode === 13) {
            if (!$(this).val() && $(this).closest('.property').attr('data-property') === 'command') {
                $(this).hide();
                $(this).prev().show();
                $(this).prev().focus();
                return;
            }
            if (commandList.indexOf($(this).val()) === -1 && $(this).closest('.property').attr('data-property') === 'command') {
                $(this).hide();
                $(this).prev().show();
                $(this).prev().focus();
                updateStatus('Please enter a valid command', 'error', 3000);
                return;
            }
            //Typing enter commits name change
            let commandIndex = $(this).closest('.command').attr('data-commandindex');
            let testCaseIndex = $(this).closest('.command').attr('data-testcaseindex');
            let property = $(this).closest('.property').attr('data-property');
            let newValue = $(this).val();

            // If the command name change, update the entire command
            if (property === 'command' && $(this).prev().text() != newValue) {
                // @todo: make command a class object?
                let newCommand = {command: newValue, value: '', target: '', targetOptions: {}};
                updateCommand(commandIndex, testCaseIndex, newCommand);
            } else if (property !== 'command') {
                updateCommandProperty(commandIndex, testCaseIndex, property, newValue);
            }
            $(this).hide();
            $(this).prev().html(newValue);
            $(this).prev().show();
            $(this).prev().focus();
        } else if (event.keyCode == 27) {
            //Esc cancels the name change
            $(this).hide();
            $(this).prev().show();
            $(this).prev().focus();
        }
    });
    $(document).unbind('focusout.property-edit').on('focusout.property-edit', '.property-edit', function (event) {
        adjustInputWidth($(this));
        if (event.keyCode == 27 || !$(this).val()) {
            //Esc cancels the name change
            $(this).hide();
            $(this).prev().show();
            $(this).prev().focus();
        } else {
            if (!$(this).val() && $(this).closest('.property').attr('data-property') === 'command') {
                $(this).hide();
                $(this).prev().show();
                $(this).prev().focus();
                return;
            }
            if (commandList.indexOf($(this).val()) === -1 && $(this).closest('.property').attr('data-property') === 'command') {
                $(this).hide();
                $(this).prev().show();
                $(this).prev().focus();
                updateStatus('Please enter a valid command', 'error', 3000);
                return;
            }
            //Typing enter commits name change
            let commandIndex = $(this).closest('.command').attr('data-commandindex');
            let testCaseIndex = $(this).closest('.command').attr('data-testcaseindex');
            let property = $(this).closest('.property').attr('data-property');
            let newValue = $(this).val();

            // If the command name change, update the entire command
            if (property === 'command' && $(this).prev().text() != newValue) {
                // @todo: make command a class object?
                let newCommand = {command: newValue, value: '', target: '', targetOptions: {}};
                updateCommand(commandIndex, testCaseIndex, newCommand);
            } else if (property != 'command') {
                updateCommandProperty(commandIndex, testCaseIndex, property, newValue);
            }
            $(this).hide();
            $(this).prev().html(newValue);
            $(this).prev().show();
            $(this).prev().focus();
        }
    });

    function adjustInputWidth(elem) {
        let minWidth = 50;
        let maxWidth = 160;

        let calculatedWidth = ((elem.val().length + 1) * 7);
        if (calculatedWidth >= minWidth && calculatedWidth <= maxWidth) {
            elem.css({'width': calculatedWidth + 'px'});
        }
    }

    $(document).unbind('keyup.teststep-name-edit').on('keyup.teststep-name-edit', '.teststep-name-edit', function (event) {
        if (event.keyCode === 13) {
            //Typing enter commits name change
            let testCaseIndex = $(this).closest('.test-case').attr('data-testcaseindex');
            let newName = $(this).val();
            updateTestCaseName(testCaseIndex, newName);
            $(this).hide();
            $(this).prev().html(newName);
            $(this).prev().show();
            $(this).prev().focus();
        } else if (event.keyCode == 27) {
            //Esc cancels the name change
            $(this).hide();
            $(this).prev().show();
            $(this).prev().focus();
        }
    });

    $(document).unbind('focusout.teststep-name-edit').on('focusout.teststep-name-edit', '.teststep-name-edit', function (event) {
        if (event.keyCode == 27) {
            //Esc cancels the name change
            $(this).hide();
            $(this).prev().show();
            $(this).prev().focus();
        } else {
            //Typing enter commits name change
            let testCaseIndex = $(this).closest('.test-case').attr('data-testcaseindex');
            let newName = $(this).val();
            updateTestCaseName(testCaseIndex, newName);
            $(this).hide();
            $(this).prev().html(newName);
            $(this).prev().show();
            $(this).prev().focus();
        }
    });
    $(document).unbind('change.select-editable').on('change.select-editable', '.select-editable select', function () {
        $(this).next().val($(this).val());
        let commandIndex = $(this).closest('.command').attr('data-commandindex');
        let testCaseIndex = $(this).closest('.command').attr('data-testcaseindex');
        let property = $(this).closest('.property').attr('data-property');
        let newValue = $(this).val();

        updateCommandProperty(commandIndex, testCaseIndex, property, newValue, true);
    });
    $(document).unbind('click.target-edit').on('click.target-edit', '.target-edit', function () {
        $(this).next().val($(this).val());
        $(this).closest('.command').find('.btn-inspect').show();
    });
    $(document).unbind('keyup.target-edit').on('keyup.target-edit', '.target-edit', function (event) {
        // adjustInputWidth($(this));
        if (event.keyCode === 13) {
            if (!$(this).val()) {
                return;
            }
            //Typing enter commits name change
            let commandIndex = $(this).closest('.command').attr('data-commandindex');
            let testCaseIndex = $(this).closest('.command').attr('data-testcaseindex');
            let property = $(this).closest('.property').attr('data-property');
            let newValue = $(this).val();
            updateCommandProperty(commandIndex, testCaseIndex, property, newValue);
            $(this).closest('.command').find('.btn-inspect').hide();
            $(this).prev().val('');
            $(this).blur();
        } else if (event.keyCode == 27) {
            //Esc cancels the name change
            $(this).hide();
            $(this).prev().show();
            $(this).prev().focus();
        }
    });

    $(document).unbind('focusout.target-edit').on('focusout.target-edit', '.target-edit', function (event) {
        // adjustInputWidth($(this));
        if (event.keyCode == 27) {
            //Esc cancels the name change
            $(this).hide();
            $(this).prev().show();
            $(this).prev().focus();
        } else {
            let commandElem = $(this).closest('.command');
            if (!$(this).val()) {
                setTimeout(() => {
                    commandElem.find('.btn-inspect').hide();
                }, 200);
                return;
            }
            //Typing enter commits name change
            let commandIndex = $(this).closest('.command').attr('data-commandindex');
            let testCaseIndex = $(this).closest('.command').attr('data-testcaseindex');
            let property = $(this).closest('.property').attr('data-property');
            let newValue = $(this).val();
            updateCommandProperty(commandIndex, testCaseIndex, property, newValue);
            setTimeout(() => {
                commandElem.find('.btn-inspect').hide();
            }, 200);
            $(this).prev().val('');
            //$(this).blur();
        }

    });

    $(document).unbind('focus.placeholder-edit').on('focus', '.placeholder-edit', function (e) {
        $(this).val('');
    });

    $(document).unbind('click.fa-plus').on('click.fa-plus', '.fa-plus', function () {
        let testCaseIndex = $(this).closest('.test-case').attr('data-testcaseindex');
        let commandCount = $('.test-case[data-testcaseindex="' + testCaseIndex + '"] .command').length;
        addCommand({
            command: 'newcommand',
            target: '',
            value: '',
            targetOptions: {}
        }, testCaseIndex, commandCount);
    });

    $(document).unbind('click.btn-break').on('click.btn-break', '.btn-breakpoint', function () {
        let testCaseIndex = $(this).closest('.test-case').attr('data-testcaseindex');
        let commandIndex = $(this).closest('.command').attr('data-commandindex');
        toggleBreakpoint(testCaseIndex, commandIndex);
    });

    createCommandContextMenu();
    createTestCaseContextMenu();
    initSortableCommand();
    commandAutoComplete();
}

function initSortableCommand() {
    $('.command-container').sortable({
        items: '.sortable',
        handle: '.grippy',
        start: function (event, ui) {
            let itemIndex = ui.item.index();
            let testCaseIndex = ui.item.closest('.test-case').attr('data-testcaseindex');
            draggedItemStartIndex = itemIndex;
            removeBreakpoint(testCaseIndex, draggedItemStartIndex);
        },
        stop: function (event, ui) {
            let itemIndex = ui.item.index();
            draggedItemStopIndex = itemIndex;
            let testCaseIndex = ui.item.closest('.test-case').attr('data-testcaseindex');
            if (draggedItemStopIndex !== draggedItemStartIndex) {
                updateCommandIndex(testCaseIndex, draggedItemStartIndex, draggedItemStopIndex);
            }
        }
    });
}

function commandAutoComplete() {
    $('.property[data-property="command"] .property-edit').each(function () {
        //Check if the element already has autocomplete
        if (!$(this).hasClass('ui-autocomplete-input')) {
            $(this).autocomplete({
                position: {collision: 'flip'},
                minLength: 0,
                source: commandList,
                select: function (event, ui) {
                    let commandIndex = $(this).closest('.command').attr('data-commandindex');
                    let testCaseIndex = $(this).closest('.command').attr('data-testcaseindex');
                    let property = $(this).closest('.property').attr('data-property');
                    let newValue = ui.item.value;
                    updateCommandProperty(commandIndex, testCaseIndex, property, newValue);
                }
            });
        }
    });
}

function createCommandContextMenu() {
    $(function () {
        $.contextMenu({
            selector: '.command',
            callback: function (key, options, rootMenu, originalEvent) {
                let testCaseIndex = options.$trigger.attr('data-testcaseindex');
                let commandIndex = options.$trigger.attr('data-commandindex');
                switch (key) {
                    case 'delete':
                        deleteCommand(testCaseIndex, commandIndex);
                        break;
                    // Duplicating logic in next steps:
                    // 1. First get command we want duplicate
                    // 2. Add new command to the end of commands array
                    // 3. Move new command to the appropriate index (after duplicated command) if not
                    // the last command was duplicated
                    // NOTE: Made in this way to reuse and to not duplicate breakpoint moving logic
                    // after command adding in updateCommandIndex function
                    case 'duplicate':
                        getSuite().then(suite => {
                            // get command that will be duplicated
                            let command = suite.test_cases[testCaseIndex].commands[commandIndex];
                            // get all commands length
                            let commandsLength = parseInt(suite.test_cases[testCaseIndex].commands.length);
                            // make index of new command made by duplicating
                            let nextCommandIndex = (parseInt(commandIndex) + 1);
                            // at first adding new command to the end of the commands array
                            addCommand(command, testCaseIndex, commandsLength, function () {});
                            // than update command index to appropriate place if not the last command was duplicated
                            // if the last command was duplicated - do nothing
                            if(commandsLength !== nextCommandIndex) {
                                updateCommandIndex(testCaseIndex, commandsLength, nextCommandIndex);
                            }
                        });
                        break;
                    case 'breakpoint': {
                        toggleBreakpoint(testCaseIndex, commandIndex);
                        break;
                    }
                    case 'exec':
                        getSuite().then(suite => playback.playSingleCommand(suite, testCaseIndex, commandIndex));
                        break;
                }
            },
            items: {
                'duplicate': {name: 'Duplicate'},
                'delete': {name: 'Delete'},
                'sep1': '---------',
                'exec': {name: 'Execute command'},
                'sep2': '---------',
                'breakpoint': {name: 'Toggle breakpoint'}
            }
        });
    });
}

function createTestCaseContextMenu() {
    $(function () {
        //Context menu for the title section of each teststep
        $.contextMenu({
            selector: '.test-case .title',
            callback: function (key, options, rootMenu, originalEvent) {
                let testCaseIndex = options.$trigger.closest('.test-case').attr('data-testcaseindex');
                let commandIndex = options.$trigger.closest('.test-case').attr('data-commandindex');
                switch (key) {
                    case 'addcommand':
                        let commandCount = $('.test-case[data-testcaseindex="' + testCaseIndex + '"] .command').length;
                        addCommand({
                            command: 'newcommand',
                            target: '',
                            value: '',
                            targetOptions: {}
                        }, testCaseIndex, commandCount);
                        break;
                    case 'addteststep':
                        addNewTestCase('Test step Name');
                        break;
                    case 'delete':
                        deleteTestCase(testCaseIndex, commandIndex);
                        break;
                    case 'duplicate': {
                        getSuite().then(suite => {
                            let testCaseCount = $('.test-case').length;
                            let testCase = suite.test_cases[testCaseIndex];
                            addTestCase(testCaseCount, testCase);
                        });
                        break;
                    }
                    case 'expandall':
                        unfoldAll();
                        break;
                    case 'collapseall':
                        foldAll();
                        break;
                }
            },
            items: {
                'addcommand': {name: 'Add command'},
                'addteststep': {name: 'Add test step'},
                'duplicate': {name: 'Duplicate'},
                'delete': {name: 'Delete'},
                'sep1': '---------',
                'expandall': {name: 'Expand all'},
                'collapseall': {name: 'Collapse all'},

            }
        });

        //Context menu for the test case container
        $.contextMenu({
            selector: '#test-cases',
            callback: function (key, options, rootMenu, originalEvent) {
                let testCaseIndex = options.$trigger.closest('.test-case').attr('data-testcaseindex');
                let commandIndex = options.$trigger.closest('.test-case').attr('data-commandindex');
                switch (key) {
                    case 'addteststep':
                        addNewTestCase('Test step Name');
                        break;
                    case 'expandall':
                        unfoldAll();
                        break;
                    case 'collapseall':
                        foldAll();
                        break;
                }
            },
            items: {
                'addteststep': {name: 'Add test step'},
                'sep1': '---------',
                'expandall': {name: 'Expand all'},
                'collapseall': {name: 'Collapse all'},
            }
        });
    });
}

function addBreakpoint(testCaseIndex, commandIndex) {
    let commandObj = $(".command[data-testCaseIndex='" + testCaseIndex + "'][data-commandIndex='" + commandIndex + "']");
    commandObj.find('.btn-breakpoint').addClass('active');

    let b = {
        testCaseIndex: testCaseIndex,
        commandIndex: commandIndex
    };
    playback.breakPoints.push(b);
}

function removeBreakpoint(testCaseIndex, commandIndex) {
    if (commandIndex !== '*') {
        let commandObj = $(".command[data-testCaseIndex='" + testCaseIndex + "'][data-commandIndex='" + commandIndex + "']");
        commandObj.find('.btn-breakpoint').removeClass('active');

        for (let i = 0; i < playback.breakPoints.length; i++) {
            if (playback.breakPoints[i].testCaseIndex == testCaseIndex && playback.breakPoints[i].commandIndex == commandIndex) {
                playback.breakPoints.splice(i, 1);
            }
        }
    }
    else{
        for (let i = playback.breakPoints.length-1; i >=0; i--) {
            if (playback.breakPoints[i].testCaseIndex == testCaseIndex) {
                let commandObj = $(".command[data-testCaseIndex='" + testCaseIndex + "'][data-commandIndex='" + playback.breakPoints[i].commandIndex + "']");
                commandObj.find('.btn-breakpoint').removeClass('active');
                playback.breakPoints.splice(i, 1);
            }
        }
    }
}

function toggleBreakpoint(testCaseIndex, commandIndex) {
    if (!isNaN(testCaseIndex)) {
        testCaseIndex = parseInt(testCaseIndex);
    }
    if (!isNaN(commandIndex)) {
        commandIndex = parseInt(commandIndex);
    }
    let isBreakpoint = false;
    for (let i = 0; i < playback.breakPoints.length; i++) {
        if (playback.breakPoints[i].testCaseIndex == testCaseIndex && playback.breakPoints[i].commandIndex == commandIndex) {
            //Remove breakpoint
            isBreakpoint = true;
        }
    }
    if (isBreakpoint) {
        removeBreakpoint(parseInt(testCaseIndex), parseInt(commandIndex));
    } else {
        addBreakpoint(parseInt(testCaseIndex), parseInt(commandIndex));
    }
}

function isBreakpoint(testCaseIndex, commandIndex){
    for (let i = 0; i < playback.breakPoints.length; i++) {
        if (playback.breakPoints[i].testCaseIndex == testCaseIndex && playback.breakPoints[i].commandIndex == commandIndex) {
            return i;
        }
    }
    return null;
}

function drawBreakpoints() {
    for (let i = 0; i < playback.breakPoints.length; i++) {
        let commandObj = $(".command[data-testCaseIndex='" + playback.breakPoints[i].testCaseIndex + "'][data-commandIndex='" + playback.breakPoints[i].commandIndex + "']");
        commandObj.find('.btn-breakpoint').addClass('active');
    }
}

function clearReplayStatus() {
    $('.command').removeAttr('data-status');
    $('.command').find('.command-status img').attr('src', '').hide();
    clearStatus();
}

function reloadSuite(suite) {
    showLoader();
    if (suite) {
        loadSuite(suite);
        linkEvents();
        clearStatus();
        drawBreakpoints();
    } else {
        getSuite().then(loadSuite, noRecording).then(linkEvents).then(clearStatus).then(drawBreakpoints);
    }
    hideLoader();
}

function noRecording() {
    return new Promise(function (resolve, reject) {
        replayStatus = 'norecording';
        switchOnReplayStatus(replayStatus);
    });
}

function startReplay() {
    backgroundRecorder.replayStatus = 'replaying';
    chrome.tabs.onActivated.addListener(tabsOnActivatedHandler);
    replayStatus = 'replaying';

    clearReplayStatus();
    initReplayWindow().then(windowId => {
        attachPrompt(windowId);
        switchToReplayWindow(windowId);
        switchToCurrentWindow();
        replayingWindow = windowId;
        getSuite().then(suite => playback.playSuite(suite, 0));
    });
}

function attachPrompt(windowId) {
    chrome.tabs.query({windowId: windowId, active: true}).then((tabs) => {
        chrome.tabs.sendMessage(tabs[0].id, {command: 'attachPrompt'}).catch(() => {});
    }).catch(() => {});
}

function startReplayHandler() {
    if (replayStatus === 'pause') {
        disableBtn('play');
        enableBtn('pause');
        playback.resume();
        updateStatus('');
    } else if (replayStatus === 'stop') {
        // reloadSuite();
        startReplay();
        switchOnReplayStatus('replaying');
        updateStatus('');
    } else if (replayStatus === 'breakpoint') {
        disableBtn('play');
        enableBtn('pause');
        playback.skipNextBreakpoint = true;
        playback.resume();
        updateStatus('');
    }
    replayStatus = 'replaying';
    disableBtn('edit');
}

function pauseReplay() {
    switchOnReplayStatus('pause');
    playback.pause();
    updateStatus('Replay paused!');
    replayStatus = 'pause';
}

function failedReplay(reason) {
    replayStatus = 'stop';
    enableBtn('play');
    disableBtn('pause');
    disableBtn('stop');
    enableBtn('edit');
    updateStatus('Test case failed!. ' + reason, 'error');
    closeReplayWindow();
}

function successFullReplay() {
    replayStatus = 'stop';
    enableBtn('play');
    disableBtn('pause');
    disableBtn('stop');
    enableBtn('edit');
    updateStatus('Replay ended. Everything OK!');
    closeReplayWindow();
}

function switchToCurrentWindow() {
    chrome.windows.getCurrent(windows => {
        chrome.windows.update(windows.id, {focused: true});
    });
}

function switchToReplayWindow(id) {
    chrome.windows.update(id, {focused: true});
}

function registerTab() {
    chrome.runtime.sendMessage({command: 'open_debugger'}).catch((e) => {
        console.log(e);
    });
}

function getSuite() {
    return new Promise(function (resolve, reject) {
        chrome.runtime.sendMessage({command: 'getCurrentSuite'}).then(suite => {
            if (suite.suite) {
                resolve(suite.suite);
            } else {
                reject();
            }
        }).catch(() => {});
    });
}

function getExportJsonSuite() {
    return new Promise(function (resolve, reject) {
        chrome.runtime.sendMessage({command: 'getExportJsonSuite'}).then(suite => {
            if (suite.suite) {
                resolve(suite.suite);
            } else {
                reject();
            }
        }).catch(() => {});
    });
}

function initReplayWindow() {
    return new Promise(resolve => {
        const newWindowParams = {
            top: 0,
            left: 0,
            state: 'normal',
            focused: false,
        };

        chrome.windows.create(newWindowParams, windows => {
            const newWindowId = windows.id;
            checkWindowExists(newWindowId).then(() => {
                setReplayWindow(newWindowId, newWindowId);
                resolve(newWindowId);
            });
            chrome.windows.onRemoved.addListener(windowId => {
                if (windowId === newWindowId && replayStatus !== 'stop') {
                    stopReplay();
                }
            })
        });
    });
}

function setReplayWindow(selfWindow, contentWindow) {
    extCommand.setContentWindowId(contentWindow);
}

function checkWindowExists(id) {
    return new Promise(function (resolve, reject) {
        chrome.windows.get(id, function (windows) {
            if (chrome.runtime.lastError) {
                console.log(chrome.runtime.lastError.message);
                reject();
            }
            if (windows) {
                resolve(windows);
            } else {
                reject();
            }
        });
    });

}

window.onunload = function () {
    chrome.runtime.sendMessage({command: 'close_debugger'}).then((res) => {
        console.log(res);
    }).catch(() => {});
};

chrome.runtime.onMessage.addListener(
    function (request, sender, sendResponse) {
        if (request.command) {
            switch (request.command) {
                case 'testSuiteNotification':
                    if (request.options) {
                        let indexes = request.options.indexes;
                        let suite = request.observable;
                        switch (request.options.action) {
                            case 'addCommand': {
                                let testCaseIndex = indexes.testCaseIndex;
                                let commandIndex = indexes.commandIndex;
                                let commandObj = renderCommandObject(testCaseIndex, commandIndex, suite);
                                if (commandIndex != 0 && $('.test-case[data-testcaseindex = "' + testCaseIndex + '"] .command[data-commandindex="' + commandIndex + '"').length) {
                                    let existingCommand = $('.test-case[data-testcaseindex = "' + testCaseIndex + '"] .command[data-commandindex="' + commandIndex + '"');
                                    existingCommand.before(commandObj);
                                    //Update the next command elements data-commandindex attribute
                                    existingCommand.nextAll().addBack().each(function () {
                                        let commandIndex = $(this).attr('data-commandindex');
                                        $(this).attr('data-commandindex', parseInt(commandIndex) + 1);
                                    });
                                } else {
                                    //Added new command
                                    $('.test-case[data-testcaseindex = "' + testCaseIndex + '"] .content .command-container').append(commandObj);
                                    let appendedElement = $('.test-case[data-testcaseindex = "' + testCaseIndex + '"] .command[data-commandindex="' + commandIndex + '"');
                                    unfoldTestCase(testCaseIndex, () => {
                                        $('#test-cases').scrollTop($('#test-cases').scrollTop() + appendedElement.position().top - $('#test-cases').height());
                                        appendedElement.find('div[data-property="command"] .command-property.span-placeholder').click();
                                    })
                                }
                                commandAutoComplete();
                                break;
                            }
                            case 'addTestCase': {
                                let testCaseIndex = indexes.testCaseIndex;
                                let testCaseObj = renderTestCaseObject(testCaseIndex, suite);
                                $('#test-cases').append(testCaseObj);
                                initSortableCommand();
                                commandAutoComplete();
                                break;
                            }
                            case 'updateTestCaseName': {
                                let testCaseIndex = indexes.testCaseIndex;
                                let testCaseName = suite.test_cases[testCaseIndex].testStep;
                                $('.test-case[data-testcaseindex = "' + testCaseIndex + '"] .title .teststep-name').text(testCaseName);
                                break;
                            }
                            case 'updateCommand': {
                                let testCaseIndex = indexes.testCaseIndex;
                                let commandIndex = indexes.commandIndex;
                                let commandObj = renderCommandObject(testCaseIndex, commandIndex, suite);
                                $('.test-case[data-testcaseindex = "' + testCaseIndex + '"] .command[data-commandindex="' + commandIndex + '"]').replaceWith(commandObj);
                                commandAutoComplete();
                            }
                            case 'updateCommandProperty': {
                                let testCaseIndex = indexes.testCaseIndex;
                                let commandIndex = indexes.commandIndex;
                                let commandProperty = indexes.commandProperty;

                                if (commandProperty !== 'command') {
                                    let command = suite.test_cases[testCaseIndex].commands[commandIndex];
                                    let commandName, commandValue, commandTarget = '';
                                    let targetOptions = {};

                                    commandName = command.command;
                                    if (command.value) {
                                        commandValue = suite.test_cases[testCaseIndex].commands[commandIndex].value;
                                    }
                                    if (command.target) {
                                        commandTarget = suite.test_cases[testCaseIndex].commands[commandIndex].target;
                                    }
                                    if (command.targetOptions) {
                                        targetOptions = command.targetOptions;
                                    }

                                    let commandParameters = getCommandParameters(commandName);
                                    let paramTargetType = commandParameters.target ? commandParameters.target.type : null;
                                    let paramTargetDesc = commandParameters.target ? commandParameters.target.description : null;

                                    let commandObj = $('.test-case[data-testcaseindex = "' + testCaseIndex + '"] .command[data-commandindex="' + commandIndex + '"]');
                                    commandObj.find('div[data-property="command"] .command-property').text(commandName);
                                    commandObj.find('div[data-property="value"] .command-property').text(commandValue);
                                    commandObj.find('div[data-property="target"]').html(renderTargetObject(commandTarget, targetOptions, paramTargetType, paramTargetDesc));
                                } else {
                                    let commandObj = renderCommandObject(testCaseIndex, commandIndex, suite);
                                    $('.test-case[data-testcaseindex = "' + testCaseIndex + '"] .command[data-commandindex="' + commandIndex + '"]').replaceWith(commandObj);
                                    commandAutoComplete();
                                }
                                break;
                            }
                            case 'deleteCommand': {
                                let testCaseIndex = indexes.testCaseIndex;
                                let commandIndex = indexes.commandIndex;
                                let targetCommandObj = $('.test-case[data-testcaseindex = "' + testCaseIndex + '"] .command[data-commandindex="' + commandIndex + '"]');
                                removeBreakpoint(testCaseIndex, commandIndex);
                                let tempBreakpoints = JSON.parse(JSON.stringify(playback.breakPoints));

                                targetCommandObj.nextAll().each(function () {
                                    let commandIndex = $(this).attr('data-commandindex');
                                    $(this).attr('data-commandindex', parseInt(commandIndex) - 1);

                                    for(let i=0; i<playback.breakPoints.length; i++){
                                        if(playback.breakPoints[i].testCaseIndex == testCaseIndex && playback.breakPoints[i].commandIndex == commandIndex){
                                            tempBreakpoints[i].commandIndex = playback.breakPoints[i].commandIndex - 1;
                                        }
                                    }

                                });

                                playback.breakPoints = JSON.parse(JSON.stringify(tempBreakpoints));
                                targetCommandObj.remove();
                                break;
                            }
                            case 'deleteTestCase': {
                                let testCaseIndex = indexes.testCaseIndex;
                                let targetTestCaseObj = $('.test-case[data-testcaseindex = "' + testCaseIndex + '"]');

                                removeBreakpoint(testCaseIndex, '*');
                                let tempBreakpoints = JSON.parse(JSON.stringify(playback.breakPoints));

                                targetTestCaseObj.nextAll().each(function () {
                                    let testCaseIndex = $(this).attr('data-testcaseindex');
                                    $(this).attr('data-testcaseindex', parseInt(testCaseIndex) - 1);

                                    for(let i=0; i<playback.breakPoints.length; i++){
                                        if(playback.breakPoints[i].testCaseIndex == testCaseIndex){
                                            tempBreakpoints[i].testCaseIndex = playback.breakPoints[i].testCaseIndex - 1;
                                        }
                                    }

                                    //Update testcaseindex of each command
                                    $(this).find('.command-container .command').attr('data-testcaseindex', parseInt(testCaseIndex) - 1)
                                });

                                playback.breakPoints = JSON.parse(JSON.stringify(tempBreakpoints));

                                targetTestCaseObj.remove();
                                //Remove all breakpoints in the testcase
                                break;
                            }
                            case 'updateCommandIndex': {
                                let testCaseIndex = indexes.testCaseIndex;
                                let commandFromIndex = indexes.commandFromIndex;
                                let commandToIndex = indexes.commandToIndex;

                                let targetTestCaseObj = $('.test-case[data-testcaseindex="' + testCaseIndex + '"]');
                                let commandFrom = targetTestCaseObj.find('.command[data-commandindex="' + commandFromIndex + '"]');
                                let commandTo = targetTestCaseObj.find('.command[data-commandindex="' + commandToIndex + '"]');
                                let resultCommand;

                                removeBreakpoint(testCaseIndex, commandFromIndex);
                                let tempBreakpoints = JSON.parse(JSON.stringify(playback.breakPoints));

                                //Dragged up-to-down
                                if (commandFromIndex < commandToIndex) {
                                    commandTo.after(commandFrom);
                                    resultCommand = commandTo.next();
                                    resultCommand.prevAll().each(function () {
                                        let commandIndex = $(this).attr('data-commandindex');
                                        if (commandIndex > commandFromIndex) {
                                            //Update breakpoints on commands move
                                            let iBreakpoint = isBreakpoint(testCaseIndex, commandIndex);
                                            if(iBreakpoint !== null){
                                                tempBreakpoints[iBreakpoint].commandIndex = playback.breakPoints[iBreakpoint].commandIndex - 1
                                            }

                                            $(this).attr('data-commandindex', parseInt(commandIndex) - 1);
                                        }
                                    });
                                }
                                //Dragged down-to-up
                                else {
                                    commandTo.before(commandFrom);
                                    resultCommand = commandTo.prev();
                                    resultCommand.nextAll().each(function () {
                                        let commandIndex = $(this).attr('data-commandindex');
                                        if (commandIndex < commandFromIndex) {
                                            //Update breakpoints on commands move
                                            let iBreakpoint = isBreakpoint(testCaseIndex, commandIndex);
                                            if(iBreakpoint !== null){
                                                tempBreakpoints[iBreakpoint].commandIndex = playback.breakPoints[iBreakpoint].commandIndex + 1
                                            }

                                            $(this).attr('data-commandindex', parseInt(commandIndex) + 1);
                                        }
                                    });
                                }
                                playback.breakPoints = JSON.parse(JSON.stringify(tempBreakpoints));
                                resultCommand.attr('data-commandindex', commandToIndex);
                                break;
                            }
                        }
                    } else {
                        console.log('No options object');
                    }
                    break;
                case 'recorderNotification': {
                    let recorder = request.observable;
                    switchOnRecordingState(recorder.recording);
                    break;
                }
                case 'startReplay':
                    startReplayHandler();
                    break;
                case 'changeWindowSize':
                    const [width, height] = request.value;
                    const updatedOptions = {
                        state: 'normal',
                        left: 0,
                        top: 0,
                        width,
                        height,
                    };
                    chrome.windows.update(replayingWindow, updatedOptions);
                    break;
                case 'maximizeWindow':
                    const isMac = window.navigator.platform.search('Mac') === 0;
                    if (isMac) {
                        const options = {
                            width: screen.availWidth,
                            height: screen.availHeight,
                        };
                        chrome.windows.update(replayingWindow, options);
                    } else {
                        chrome.windows.update(replayingWindow, {state: 'maximized'});
                    }
                    break;
            }
        }
        //force focus
        chrome.windows.getAll(windows => {
            const debuggerWindow = windows.filter(window => window.type === 'popup');
            if (debuggerWindow && debuggerWindow[0].id && debuggerWindow[0].id) {
                chrome.windows.update(debuggerWindow[0].id, {focused: true });
            }
        });
        if (request.selectTarget) {
            var target = request.target;
            handleInspectorSelection(target);
        }
        if (request.cancelSelectTarget) {
            chrome.tabs.query({}, tabs => {
                for (let tab in tabs) {
                    if (!tabs[tab].url.startsWith('chrome-extension://') && !tabs[tab].url.startsWith('chrome://')) {
                        chrome.tabs.sendMessage(tabs[tab].id, {
                            selectMode: true,
                            selecting: false
                        }).catch(function (err) {
                        });
                    }
                }
            });
            $('.btn-inspect').hide();
            window.focus();
        }
    }
);

function switchOnRecordingState(state) {
    if (state === 'stopped') {
        enableBtn('play');
        disableBtn('pause');
        disableBtn('stop');
        enableBtn('speed');
    } else {
        disableBtn('play');
        disableBtn('pause');
        disableBtn('stop');
        disableBtn('speed');
    }
}

function handleInspectorSelection(target) {
    chrome.tabs.query({}, tabs => {
        for (let tab in tabs) {
            if (!tabs[tab].url.startsWith('chrome-extension://') && !tabs[tab].url.startsWith('chrome://')) {
                // chrome.windows.update(tabs[tab].windowId, {focused: true});
                chrome.tabs.sendMessage(tabs[tab].id, {selectMode: true, selecting: false}).catch(function (err) {
                });
            }
        }
    });
    $('.btn-inspect').hide();
    window.focus();

    var locatorString = target[0][0];
    let commandObj = $('.command[data-testcaseindex="' + inspectorCurrentTestCaseIndex + '"][data-commandindex="' + inspectorCurrentCommandIndex + '"]');
    updateCommandProperty(inspectorCurrentCommandIndex, inspectorCurrentTestCaseIndex, 'target', target[0][0]);
    updateCommandProperty(inspectorCurrentCommandIndex, inspectorCurrentTestCaseIndex, 'targetOptions', target);
    commandObj.find('div[data-property="target"]').html(renderTargetObject(target[0][0], target, 'locator'));
}

function checkRecordingStatus() {
    chrome.runtime.sendMessage({command: 'check_status'}).then(response => {
        switchOnRecordingState(response.recording);
        switchOnReplayStatus(replayStatus);
    }).catch(() => {});
}

function checkMovement() {
    chrome.windows.getCurrent(function (currentWindows) {
        if (currentWindows.left !== positionLeft || currentWindows.top !== positionTop) {
            let pos = {
                left: currentWindows.left,
                top: currentWindows.top
            };
            chrome.storage.local.set({'position-debugger': pos});
            positionLeft = currentWindows.left;
            positionTop = currentWindows.top;
        }
    });
}

function isMacintosh() {
    return navigator.platform.indexOf('Mac') > -1;
}

function isWindows() {
    return navigator.platform.indexOf('Win') > -1;
}

//Show loader in debugger
function showLoader() {
    $('#loader').fadeIn('fast');
}

//Hide loader in debugger
function hideLoader() {
    $('#loader').fadeOut('fast');
}

function tabsOnActivatedHandler(activeInfo) {
    chrome.tabs.sendMessage(activeInfo.tabId, {
        command: 'attachPrompt'
    }).catch(() => {});
}

function detachPromptAllTabs() {
    chrome.tabs.query({}, function (tabs) {
        for (let tab in tabs) {
            chrome.tabs.sendMessage(tabs[parseInt(tab)].id, {command: 'detachPrompt'}).catch(() => {});
        }
    })
}

function closeReplayWindow() {
    chrome.windows.remove(replayingWindow);
}


playback = new OldPlaybackApi({
    updateCommandStatus: updateCommandStatus,
    updateTestCaseStatus: updateTestCaseStatus,
    updateStatus: updateStatus,
    successFullReplay: successFullReplay,
    failedReplay: failedReplay,
    switchOnReplayStatus: switchOnReplayStatus
});
