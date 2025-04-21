import { useEffect, useState } from "react";
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";

const ChartPage = () => {
  const [chartData, setChartData] = useState([]);

  useEffect(() => {
    fetch("http://localhost:5000/chart_data")
      .then((res) => res.json())
      .then((data) => setChartData(data))
      .catch(console.error);
  }, []);

  return (
    <div className="p-4">
      <h2 className="text-xl font-bold mb-4">Количество сообщений по дням (monitor_deadline_at)</h2>
      <ResponsiveContainer width="100%" height={300}>
        <LineChart data={chartData}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="date" />
          <YAxis allowDecimals={false} />
          <Tooltip />
          <Line type="monotone" dataKey="count" stroke="#8884d8" strokeWidth={2} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
};

export default ChartPage;
