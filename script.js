document.addEventListener('DOMContentLoaded', () => {
    // --- 要素の取得 ---
    const tabButtons = document.querySelectorAll('.tab-button');
    const tabContents = document.querySelectorAll('.tab-content');

    const topicInputForm = document.getElementById('topic-input-form');
    const topicTextInput = document.getElementById('topic-text');
    const topicDurationInput = document.getElementById('topic-duration');
    const topicMemoInput = document.getElementById('topic-memo'); // メモ入力欄
    const totalDurationDisplay = document.getElementById('total-duration-display');
    const agendaList = document.getElementById('agenda-list');

    const timerDisplay = document.getElementById('timer-display');
    const currentTopicNameDisplay = document.getElementById('current-topic-name');
    const currentTopicMemoDisplay = document.getElementById('current-topic-memo'); // 現在のテーマのメモ表示
    const nextTopicNameDisplay = document.getElementById('next-topic-name');
    const nextTopicMemoDisplay = document.getElementById('next-topic-memo'); // 次のテーマのメモ表示
    const startPauseButton = document.getElementById('start-pause-button');
    const resetButton = document.getElementById('reset-button');
    const nextTopicButton = document.getElementById('next-topic-button');
    const extensionMinutesInput = document.getElementById('extension-minutes');
    const extendTimerButton = document.getElementById('extend-timer-button');
    const progressList = document.getElementById('progress-list');

    const toggleSidebarTimerButton = document.getElementById('toggle-sidebar-timer');
    const topicProgressSidebar = document.querySelector('.topic-progress-sidebar');

    // --- 状態変数 ---
    let topics = []; // テーマの配列。{ id, text, duration, memo, completed: false }
    let currentTopicIndex = -1;
    let timerInterval = null;
    let remainingTime = 0; // 秒単位
    let isTimerRunning = false;

    // Sortable.js のインスタンスを保持する変数
    let agendaSortableInstance = null; 

    // --- ユーティリティ関数 ---
    function generateUniqueId() {
        return '_' + Math.random().toString(36).substr(2, 9);
    }

    function formatTime(seconds) {
        const minutes = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${String(minutes).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
    }

    // --- データ管理（ローカルストレージ） ---
    function loadTopics() {
        const storedTopics = localStorage.getItem('meetingTopicsV8'); // バージョンアップでキー変更
        if (storedTopics) {
            topics = JSON.parse(storedTopics);
            // 既存データにmemoがない場合のためにデフォルト値を設定 (初回ロード時のみ)
            topics.forEach(topic => {
                if (typeof topic.memo === 'undefined') {
                    topic.memo = '';
                }
            });
        }
        renderAgendaList();
        calculateTotalDuration();
        renderProgressList();
        updateTimerDisplay(); // 初期ロード時にタイマー表示とテーマ情報を更新
    }

    function saveTopics() {
        localStorage.setItem('meetingTopicsV8', JSON.stringify(topics));
    }

    // --- タブ切り替え ---
    tabButtons.forEach(button => {
        button.addEventListener('click', () => {
            const targetTab = button.dataset.tab;

            tabButtons.forEach(btn => btn.classList.remove('active'));
            tabContents.forEach(content => content.classList.remove('active'));

            button.classList.add('active');
            document.getElementById(`${targetTab}-tab`).classList.add('active');

            if (targetTab === 'timer') {
                renderProgressList();
                updateTimerDisplay();
            } else if (targetTab === 'agenda') {
                calculateTotalDuration();
            }
        });
    });

    // --- テーマの追加（アジェンダ作成タブ） ---
    topicInputForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const text = topicTextInput.value.trim();
        const duration = parseInt(topicDurationInput.value, 10);
        const memo = topicMemoInput.value.trim(); // メモを取得

        if (text && !isNaN(duration) && duration > 0) {
            topics.push({ id: generateUniqueId(), text, duration, memo, completed: false }); // memoを追加
            saveTopics();
            renderAgendaList(); // テーマリストを再描画
            calculateTotalDuration();
            topicTextInput.value = '';
            topicDurationInput.value = '';
            topicMemoInput.value = ''; // メモ欄もクリア
            renderProgressList();
            updateTimerDisplay();
        } else {
            alert('有効な話すことと時間を入力してください。');
        }
    });

    // --- 合計議論時間の計算と表示 ---
    function calculateTotalDuration() {
        const totalMinutes = topics.reduce((sum, topic) => sum + topic.duration, 0);
        totalDurationDisplay.textContent = `${totalMinutes}分`;
    }

    // --- アジェンダリストの描画 ---
    function renderAgendaList() {
        agendaList.innerHTML = ''; // 一度リストをクリア

        // 既存のSortableインスタンスがあれば破棄
        if (agendaSortableInstance) {
            agendaSortableInstance.destroy();
            agendaSortableInstance = null;
        }

        topics.forEach((topic) => {
            const li = document.createElement('li');
            li.setAttribute('data-id', topic.id);
            li.className = 'agenda-item';

            const topicInfo = document.createElement('div');
            topicInfo.className = 'topic-info';
            topicInfo.textContent = `${topic.text} (${topic.duration}分)`;
            li.appendChild(topicInfo);

            if (topic.memo) { // メモがあれば表示
                const topicMemoDisplay = document.createElement('div');
                topicMemoDisplay.className = 'topic-memo-display';
                // 各行を <p> タグでラップすることで、CSSの箇条書きスタイルを適用しやすくする
                // 空行やスペースのみの行をフィルターする
                topicMemoDisplay.innerHTML = topic.memo.split('\n').filter(line => line.trim() !== '').map(line => `<p>${line}</p>`).join('');
                li.appendChild(topicMemoDisplay);
            }

            const deleteButton = document.createElement('button');
            deleteButton.className = 'delete-button';
            deleteButton.textContent = '削除';
            deleteButton.addEventListener('click', (e) => {
                e.stopPropagation();
                deleteTopic(topic.id);
            });
            li.appendChild(deleteButton);

            agendaList.appendChild(li);
        });

        // リストアイテムが追加された後にSortableを再初期化
        if (topics.length > 0) {
            agendaSortableInstance = new Sortable(agendaList, {
                animation: 150,
                ghostClass: 'sortable-ghost',
                onUpdate: function (evt) {
                    const movedItem = topics.splice(evt.oldIndex, 1)[0];
                    topics.splice(evt.newIndex, 0, movedItem);
                    saveTopics();
                    calculateTotalDuration();
                    renderProgressList();

                    const currentTopicId = (currentTopicIndex !== -1 && topics[currentTopicIndex]) ? topics[currentTopicIndex].id : null;
                    if (currentTopicId) {
                        currentTopicIndex = topics.findIndex(t => t.id === currentTopicId);
                    }
                    updateTimerDisplay();
                },
            });
        }
    }

    // --- テーマの削除 ---
    function deleteTopic(idToDelete) {
        const initialLength = topics.length;
        topics = topics.filter(topic => topic.id !== idToDelete);
        if (topics.length !== initialLength) {
            saveTopics();
            calculateTotalDuration();

            if (currentTopicIndex !== -1) {
                const newCurrentIndex = topics.findIndex(t => t.id === (topics[currentTopicIndex]?.id));
                if (newCurrentIndex === -1) {
                    resetTimer();
                } else {
                    currentTopicIndex = newCurrentIndex;
                }
            }

            renderAgendaList();
            renderProgressList();
            updateTimerDisplay();
        }
    }

    // --- タイムキーパータブの進捗リスト描画 ---
    function renderProgressList() {
        progressList.innerHTML = '';
        if (topics.length === 0) {
            progressList.innerHTML = '<p>テーマがありません。</p>';
            return;
        }

        topics.forEach((topic, index) => {
            const li = document.createElement('li');
            li.setAttribute('data-id', topic.id);
            li.textContent = `${topic.text} (${topic.duration}分)`;

            if (topic.completed) {
                li.classList.add('completed');
            }
            if (index === currentTopicIndex) { // 今話しているテーマのみハイライト
                li.classList.add('active-topic');
            }

            li.addEventListener('click', () => {
                if (isTimerRunning && currentTopicIndex !== index) {
                    if (!confirm('タイマーをリセットしてこのテーマを開始しますか？')) {
                        return;
                    }
                }
                selectTopic(index);
                // startTimer(); // テーマをクリックしたら自動的に開始したい場合
            });

            progressList.appendChild(li);
        });
    }

    // 特定のテーマを選択し、タイマーをセット
    function selectTopic(index) {
        pauseTimer(); // 必ず一時停止してから選択

        if (index < 0 || index >= topics.length || !topics[index]) {
            currentTopicIndex = -1;
            remainingTime = 0;
            updateTimerDisplay();
            renderProgressList();
            return;
        }

        currentTopicIndex = index;
        topics.forEach((t, i) => t.completed = (i < index));
        topics[index].completed = false; // 選択したテーマは未完了に戻す
        
        remainingTime = topics[currentTopicIndex].duration * 60;
        
        saveTopics();
        updateTimerDisplay();
        renderProgressList();
    }

    // タイマー表示と現在のテーマ情報を更新
    function updateTimerDisplay() {
        timerDisplay.textContent = formatTime(remainingTime);

        // タイマーの色を更新
        timerDisplay.classList.remove('warning', 'critical', 'overtime');
        if (remainingTime > 0) {
            if (remainingTime <= 60) { // 残り1分以下
                timerDisplay.classList.add('warning');
            }
            if (remainingTime <= 30) { // 残り30秒以下
                timerDisplay.classList.remove('warning'); // warningを削除してcriticalを優先
                timerDisplay.classList.add('critical');
            }
        } else { // 時間が0以下（オーバータイム）
            timerDisplay.classList.add('overtime');
        }


        // 現在のテーマ情報表示
        if (currentTopicIndex !== -1 && topics[currentTopicIndex]) {
            const currentTopic = topics[currentTopicIndex];
            currentTopicNameDisplay.textContent = `${currentTopic.text} (${formatTime(remainingTime)} / ${currentTopic.duration}分)`;
            // メモの内容を <p> タグでラップして表示
            currentTopicMemoDisplay.innerHTML = currentTopic.memo ? currentTopic.memo.split('\n').filter(line => line.trim() !== '').map(line => `<p>${line}</p>`).join('') : 'メモはありません。';
        } else {
            currentTopicNameDisplay.textContent = 'なし';
            currentTopicMemoDisplay.innerHTML = '';
        }

        // 次のテーマ情報表示
        const nextUncompletedTopic = topics.find((t, i) => i > currentTopicIndex && !t.completed);
        if (nextUncompletedTopic) {
            nextTopicNameDisplay.textContent = `${nextUncompletedTopic.text} (${nextUncompletedTopic.duration}分)`;
            nextTopicMemoDisplay.innerHTML = nextUncompletedTopic.memo ? nextUncompletedTopic.memo.split('\n').filter(line => line.trim() !== '').map(line => `<p>${line}</p>`).join('') : 'メモはありません。';
        } else {
            nextTopicNameDisplay.textContent = 'なし';
            nextTopicMemoDisplay.innerHTML = '';
        }
    }

    // --- タイマー制御 ---
    startPauseButton.addEventListener('click', startPauseTimer);
    resetButton.addEventListener('click', resetTimer);
    nextTopicButton.addEventListener('click', handleNextTopic);
    extendTimerButton.addEventListener('click', handleExtendTimer);

    function startPauseTimer() {
        if (topics.length === 0) {
            alert('話すことを追加してください。');
            return;
        }

        // まだテーマが選択されていない、または現在のテーマの時間が0の場合
        // ただし、タイマーがすでに動いている場合は一時停止の振る舞いをする
        if (currentTopicIndex === -1 || (remainingTime <= 0 && !isTimerRunning)) {
            const firstUncompletedIndex = topics.findIndex(t => !t.completed);
            if (firstUncompletedIndex === -1) {
                alert('すべてのテーマが完了しました。');
                resetTimer();
                return;
            }
            selectTopic(firstUncompletedIndex); // 最初の未完了テーマを選択し、時間をセット
            // selectTopicはpauseTimerを内部で呼ぶので、isTimerRunningはfalseになる
        }

        if (isTimerRunning) {
            pauseTimer();
        } else {
            startTimer();
        }
    }

    function startTimer() {
        // タイマーが既に動いている、またはテーマが選択されていない場合は何もしない
        if (isTimerRunning || currentTopicIndex === -1) {
            return;
        }
        // remainingTimeが0なのにstartTimerが呼ばれた場合は、selectTopicでセットし直すことを促す
        if (remainingTime <= 0) {
            alert('現在のテーマの時間が終了しています。次のテーマを選択するか、時間を延長してください。');
            return; // ここで処理を中断
        }

        isTimerRunning = true;
        startPauseButton.textContent = '一時停止';
        startPauseButton.classList.add('pause');

        renderProgressList(); // アクティブなテーマをハイライト

        if (timerInterval) clearInterval(timerInterval); 

        timerInterval = setInterval(() => {
            if (remainingTime > 0) {
                remainingTime--;
                updateTimerDisplay();
            } else {
                clearInterval(timerInterval);
                timerInterval = null;
                isTimerRunning = false;
                startPauseButton.textContent = '開始';
                startPauseButton.classList.remove('pause');
                alert(`「${topics[currentTopicIndex].text}」の時間が終了しました！`);

                topics[currentTopicIndex].completed = true;
                saveTopics();
                renderProgressList();
                updateTimerDisplay(); // 次のテーマ表示を更新
                // 自動で次のテーマに進みたい場合は、ここで handleNextTopic() を呼び出すなど
                // 例: setTimeout(handleNextTopic, 500); // 0.5秒後に次のテーマへ
            }
        }, 1000);
    }

    function pauseTimer() {
        clearInterval(timerInterval);
        timerInterval = null;
        isTimerRunning = false;
        startPauseButton.textContent = '開始';
        startPauseButton.classList.remove('pause');
        renderProgressList(); // ハイライト解除など
        updateTimerDisplay(); // ポーズ時も色更新が必要な場合のため
    }

    function resetTimer() {
        pauseTimer(); // 必ず一時停止
        currentTopicIndex = -1;
        remainingTime = 0;
        topics.forEach(topic => topic.completed = false); // 全てのテーマを未完了に戻す
        saveTopics();
        updateTimerDisplay(); // タイマー表示とテーマ情報をリセット
        renderAgendaList(); // アジェンダ側も更新
        renderProgressList(); // 進行状況側も更新
    }

    // --- タイマー延長機能のハンドラー ---
    function handleExtendTimer() {
        const minutesToExtend = parseInt(extensionMinutesInput.value, 10);
        if (isNaN(minutesToExtend) || minutesToExtend <= 0) {
            alert('延長する時間を正しく入力してください（1分以上）。');
            return;
        }

        if (currentTopicIndex === -1) {
            alert('アクティブなテーマがありません。テーマを選択して開始してください。');
            return;
        }
        
        remainingTime += minutesToExtend * 60; // 秒に変換して追加
        updateTimerDisplay();
        alert(`${minutesToExtend}分延長しました。`);
        
        if (!isTimerRunning) {
             startTimer(); // 延長後、自動でタイマーを開始
        }
    }

    // --- 次の議論に進むボタンのハンドラー ---
    function handleNextTopic() {
        pauseTimer(); // 次のテーマに進む前に必ず一時停止

        if (currentTopicIndex !== -1 && topics[currentTopicIndex]) {
            topics[currentTopicIndex].completed = true;
            saveTopics();
        }

        const nextUncompletedIndex = topics.findIndex((t, i) => i > currentTopicIndex && !t.completed);
        if (nextUncompletedIndex !== -1) {
            selectTopic(nextUncompletedIndex);
            // 必要であれば、自動で開始
            // startTimer();
        } else {
            alert('これ以上、未完了のテーマはありません。すべての議論が終了しました。');
            resetTimer();
        }
    }

    // --- サイドバーの表示/非表示切り替え (タイマータブ内) ---
    toggleSidebarTimerButton.addEventListener('click', () => {
        topicProgressSidebar.classList.toggle('hidden');
        const toggleIcon = document.getElementById('toggle-icon-timer');
        if (topicProgressSidebar.classList.contains('hidden')) {
            toggleIcon.textContent = '▶';
        } else {
            toggleIcon.textContent = '◀';
        }
    });

    // --- 初期ロード ---
    loadTopics();
});