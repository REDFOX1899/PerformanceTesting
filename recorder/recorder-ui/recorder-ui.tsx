import React, { useEffect, useState } from 'react';
import { localSave } from '../common/local-save';
import NewGroupCreator from './new-group-creator';
import RecorderGroup from './recorder-group';
import RecorderGroupsHeader from './recorder-groups-header';
import './styles/index.scss';
import { Group } from './types';

const RecorderUi: React.FC = () => {
    const [data, setData] = useState<Group[]>([]);

    const getHttpTransactions = (d: Group[]) => {
        return d.map((x) => ({ name: x.name, counter: x.httpCounter }));
    };

    // When the component is just created - read the stored information
    useEffect(() => {
        Promise.all([
            chrome.runtime.sendMessage({ command: 'getTransactions' }).catch(() => {}),
            chrome.storage.local.get('transactions'),
        ]).then(([ui, http]) => {
            const newData: Group[] = [];
            for (let i = 0; i < ui.transactions.length; ++i) {
                newData.push({
                    name: ui.transactions[i].name,
                    uiCounter: ui.transactions[i].counter || 0,
                    httpCounter: http.transactions[i].counter || 0,
                });
            }
            setData(newData);
        });
    }, []);

    const messageListener = (request: any) => {
        if (request.command === 'testSuiteNotification') {
            const suite = request.observable;
            setData((oldData) => {
                const newData: Group[] = [];
                for (const t of suite.test_cases) {
                    const current = oldData.find((d) => d.name === t.testStep);
                    if (current) {
                        newData.push({ ...current, uiCounter: t.commands.length });
                    } else {
                        newData.push({ name: t.testStep, httpCounter: 0, uiCounter: t.commands.length });
                    }
                }
                return newData;
            });
        } else if (request.counter) {
            chrome.storage.local.get('transactions').then((items: any) => {
                const currentCount = items.transactions.reduce((total: number, cur: any) => total + cur.counter, 0);
                const delta = request.counter - currentCount;
                items.transactions[items.transactions.length - 1].counter += delta;
                localSave({
                    transactions: items.transactions,
                });
                setData((oldData) => {
                    const newData: Group[] = [];
                    for (const t of items.transactions) {
                        const current = oldData.find((d) => d.name === t.name);
                        if (current) {
                            newData.push({ ...current, httpCounter: t.counter });
                        } else {
                            newData.push({ name: t.name, uiCounter: 0, httpCounter: t.counter });
                        }
                    }
                    return newData;
                });
            });
        }
    };

    // Subscribing for messages.
    // Messages come from the background script.
    useEffect(() => {
        chrome.runtime.onMessage.addListener(messageListener);

        return () => {
            chrome.runtime.onMessage.removeListener(messageListener);
        };
    }, []);

    const lastRow = data[data.length - 1];
    const canAddNewGroup = lastRow && lastRow.uiCounter + lastRow.httpCounter > 0;

    const addNewGroup = (name: string) => {
        localSave({
            transactions: [...getHttpTransactions(data), { name, counter: 0 }],
        });
        chrome.runtime.sendMessage({ command: 'addTestCase', testCaseName: name }).catch(() => {});
    };

    const rename = (index: number, name: string) => {
        const transactions = getHttpTransactions(data);
        transactions[index].name = name;
        localSave({ transactions });

        chrome.runtime.sendMessage({
            command: 'updateTestCaseName',
            testCaseName: name,
            testCaseIndex: index,
        }).catch(() => {});

        setData((x) => {
            x[index].name = name;
            return [...x];
        });
    };

    return (
        <>
            <div id='transaction-list' className='recorder-groups'>
                <RecorderGroupsHeader count={data.length} />
                <div id='transactions' className='recorder-groups__list'>
                    {data.map((x, i) => (
                        <RecorderGroup key={i} group={x} onRename={(e) => rename(i, e)} />
                    ))}
                </div>
            </div>

            <NewGroupCreator nextIndex={data.length + 1} onCreate={addNewGroup} isEnabled={canAddNewGroup} />
        </>
    );
};

export default RecorderUi;
