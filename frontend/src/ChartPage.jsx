import { useEffect, useState } from "react";
import {
  LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer,
  CartesianGrid, ReferenceLine
} from "recharts";
import Modal from "./Modal";

const ChartPage = () => {
  const [chartData, setChartData] = useState([]);
  const [selectedDate, setSelectedDate] = useState(null);
  const [issuesByDate, setIssuesByDate] = useState({});
  const [selectedIssue, setSelectedIssue] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        const response = await fetch("http://localhost:5000/chart_data");

        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }

        const data = await response.json();

        const formattedData = data.map((item) => {
          const [year, month, day] = item.date.split("-");
          const formattedDate = `${day}.${month}.${year.slice(2)}`;
          return {
            ...item,
            date: formattedDate
          };
        });

        const issuesMap = {};
          for (const item of data) {
            const [year, month, day] = item.date.split("-");
            const formattedDate = `${day}.${month}.${year.slice(2)}`;
            issuesMap[formattedDate] = item.issues;
          }

        setChartData(formattedData);
        setIssuesByDate(issuesMap);
        setError(null);
      } catch (error) {
        console.error("Ошибка при загрузке данных:", error);
        setError(error.message);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  if (loading) return <div className="p-4">Загрузка данных...</div>;
  if (error) return <div className="p-4">Ошибка загрузки данных: {error}</div>;
  if (chartData.length === 0) return <div className="p-4">Нет данных для отображения</div>;

  const today = new Date();
  const todayStr = `${String(today.getDate()).padStart(2, "0")}.${String(today.getMonth() + 1).padStart(2, "0")}.${String(today.getFullYear()).slice(2)}`;

  function formatTimestamp(ts) {
    if (!ts) return "";
    const date = new Date(ts * 1000);
    return date.toLocaleDateString("ru-RU");
  }
  
  function getExecutorName(issue) {
    const comments = issue.comments || [];
    for (const comment of comments) {
      if (comment.monitor && comment.monitor.executor_make_answer) {
        return comment.monitor.executor_make_answer;
      }
    }
    return "Не указан";
  }
  

  const handleDateClick = (data) => {
    setSelectedDate(data.date);
  };

  const handleIdClick = (issue) => {
    setSelectedIssue(issue);
  };

  return (
    <div className="p-4">
      <h2 className="text-xl font-bold mb-4">Количество обещаний по дням (monitor_deadline_at)</h2>

      <ResponsiveContainer width="100%" height={300}>
        <LineChart data={chartData} onClick={({ activeLabel }) => handleDateClick({ date: activeLabel })}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="date" />
          <YAxis allowDecimals={false} />
          <Tooltip />
          <Line type="monotone" dataKey="count" stroke="#8884d8" strokeWidth={2} />
          <ReferenceLine x={todayStr} stroke="red" label="Сегодня" strokeDasharray="3 3" />
        </LineChart>
      </ResponsiveContainer>

      {selectedDate && issuesByDate[selectedDate]?.length > 0 && (
        <div className="mt-4">
          <h3 className="text-lg font-semibold mb-2">Заявки на {selectedDate}:</h3>
          <ul className="space-y-2">
            {issuesByDate[selectedDate].map((issue) => (
              <li key={issue.id}>
                <button
                  onClick={() => handleIdClick(issue)}
                  className="text-blue-600 underline hover:text-blue-800"
                >
                  ID {issue.id} — {issue.monitor_deadline_at}
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}

      {selectedIssue && (
        <Modal onClose={() => setSelectedIssue(null)}>
          <div className="space-y-2 text-sm">
            <div><b>Сообщение:</b> {selectedIssue.id}</div>
            <div><b>Тема:</b> {selectedIssue.theme?.title}</div>
            <div><b>Статус:</b> {selectedIssue.status?.title}</div>
            <div><b>Адрес:</b> {selectedIssue.object?.name}</div>
            <div><b>Ответственный:</b> {getExecutorName(selectedIssue)}</div>
            <div><b>Дата отображения на мониторе:</b> {formatTimestamp(selectedIssue.monitor_deadline_at)}</div>
            <div><b>Регламентный срок (Портал):</b> {formatTimestamp(selectedIssue.deadline_at)}</div>
          </div>
        </Modal>
      )}
    </div>
  );
};

export default ChartPage;
