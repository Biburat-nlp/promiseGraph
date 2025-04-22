import { useEffect, useState } from "react";
import {
  LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer,
  CartesianGrid, ReferenceLine, Legend
} from "recharts";
import Modal from "./Modal";

const REGION_IDS = {
  104: "Выхино-Жулебино",
  87: "Капотня",
  22: "Кузьминки",
  21: "Лефортово",
  89: "Люблино",
  5: "Марьино",
  71: "Некрасовка",
  34: "Нижегородский",
  41: "Печатники",
  124: "Рязанский",
  53: "Текстильщики",
  105: "Южнопортовый"
};

const COLORS = [
  "#8884d8", "#82ca9d", "#ffc658", "#ff8042", "#0088fe",
  "#00c49f", "#ffbb28", "#ff8042", "#a4de6c", "#d0ed57",
  "#83a6ed", "#8dd1e1", "#a4262c"
];

const RegionFilter = ({ regions, selectedRegions, onChange }) => {
  const [isOpen, setIsOpen] = useState(false);
  
  const toggleDropdown = () => setIsOpen(!isOpen);
  
  const handleCheckboxChange = (regionId) => {
    const newSelectedRegions = [...selectedRegions];
    
    if (regionId === "all") {
      if (selectedRegions.includes("all")) {
        onChange([]);
      } else {
        onChange(["all", ...Object.keys(regions)]);
      }
    } else {
      const regionIndex = newSelectedRegions.indexOf(regionId);
      
      if (regionIndex > -1) {
        newSelectedRegions.splice(regionIndex, 1);
        const allIndex = newSelectedRegions.indexOf("all");
        if (allIndex > -1) {
          newSelectedRegions.splice(allIndex, 1);
        }
      } else {
        newSelectedRegions.push(regionId);
        const allRegionIds = Object.keys(regions);
        const allSelected = allRegionIds.every(id => 
          newSelectedRegions.includes(id) || id === regionId
        );
        
        if (allSelected && !newSelectedRegions.includes("all")) {
          newSelectedRegions.push("all");
        }
      }
      
      onChange(newSelectedRegions);
    }
  };
  
  return (
    <div className="relative inline-block text-left">
      <div>
        <button
          type="button"
          className="inline-flex justify-center w-full rounded-md border border-gray-300 shadow-sm px-4 py-2 bg-white text-sm font-medium text-gray-700 hover:bg-gray-50 focus:outline-none"
          onClick={toggleDropdown}
        >
          Выбрать районы ({selectedRegions.includes("all") ? "Все" : selectedRegions.length})
          <svg className="-mr-1 ml-2 h-5 w-5" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
            <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
          </svg>
        </button>
      </div>
      
      {isOpen && (
        <div className="origin-top-right absolute right-0 mt-2 w-64 rounded-md shadow-lg bg-white ring-1 ring-black ring-opacity-5 divide-y divide-gray-100 focus:outline-none z-10">
          <div className="py-1 max-h-60 overflow-auto">
            <div className="flex items-center px-4 py-2">
              <input
                id="filter-all"
                type="checkbox"
                className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded"
                checked={selectedRegions.includes("all")}
                onChange={() => handleCheckboxChange("all")}
              />
              <label htmlFor="filter-all" className="ml-3 block text-sm text-gray-700">
                Весь округ
              </label>
            </div>
            {Object.entries(regions).map(([regionId, regionName]) => (
              <div key={regionId} className="flex items-center px-4 py-2">
                <input
                  id={`filter-${regionId}`}
                  type="checkbox"
                  className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded"
                  checked={selectedRegions.includes(regionId)}
                  onChange={() => handleCheckboxChange(regionId)}
                />
                <label htmlFor={`filter-${regionId}`} className="ml-3 block text-sm text-gray-700">
                  {regionName}
                </label>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

const ChartPage = () => {
  const [rawData, setRawData] = useState([]);
  const [chartData, setChartData] = useState([]);
  const [selectedDate, setSelectedDate] = useState(null);
  const [issuesByDate, setIssuesByDate] = useState({});
  const [selectedIssue, setSelectedIssue] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedRegions, setSelectedRegions] = useState(["all", ...Object.keys(REGION_IDS)]);

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        const response = await fetch("http://localhost:5000/chart_data");

        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }

        const data = await response.json();
        setRawData(data);
        
        processDataWithFilters(data, selectedRegions);
        
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
  
  useEffect(() => {
    if (rawData.length > 0) {
      processDataWithFilters(rawData, selectedRegions);
    }
  }, [selectedRegions, rawData]);

  const processDataWithFilters = (data, regionFilters) => {
    const dateMap = {};
    const issuesMap = {};
    
    for (const item of data) {
      const [year, month, day] = item.date.split("-");
      const formattedDate = `${day}.${month}.${year.slice(2)}`;
      
      if (!dateMap[formattedDate]) {
        dateMap[formattedDate] = { date: formattedDate };
        issuesMap[formattedDate] = {};
      }
      
      
      for (const issue of item.issues) {
        const regionId = issue.region_id ? issue.region_id.toString() : "unknown";
        
        if (!issuesMap[formattedDate][regionId]) {
          issuesMap[formattedDate][regionId] = [];
        }
        
        issuesMap[formattedDate][regionId].push(issue);
        
        if (!dateMap[formattedDate][regionId]) {
          dateMap[formattedDate][regionId] = 0;
        }
        dateMap[formattedDate][regionId] += 1;
        
        if (!dateMap[formattedDate]["total"]) {
          dateMap[formattedDate]["total"] = 0;
        }
        dateMap[formattedDate]["total"] += 1;
      }
    }
    
    const formattedData = Object.values(dateMap);
    
    formattedData.sort((a, b) => {
      const [dayA, monthA, yearA] = a.date.split(".");
      const [dayB, monthB, yearB] = b.date.split(".");
      return new Date(`20${yearA}-${monthA}-${dayA}`) - new Date(`20${yearB}-${monthB}-${dayB}`);
    });
    
    setChartData(formattedData);
    setIssuesByDate(issuesMap);
  };

  const handleRegionFilterChange = (newSelectedRegions) => {
    setSelectedRegions(newSelectedRegions);
  };

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
  
  function getRegionName(regionId) {
    if (!regionId) return "Не указан";
    return REGION_IDS[regionId] || `Неизвестный район (ID: ${regionId})`;
  }

  const handleDateClick = (data) => {
    if (data && data.activeLabel) {
      setSelectedDate(data.activeLabel);
    }
  };

  const handleIdClick = (issue) => {
    setSelectedIssue(issue);
  };
  
  const getFilteredIssuesForDate = (date) => {
    if (!date || !issuesByDate[date]) return [];
    
    const issues = [];
    
    Object.keys(issuesByDate[date]).forEach(regionId => {
      if (selectedRegions.includes("all") || selectedRegions.includes(regionId)) {
        issues.push(...issuesByDate[date][regionId]);
      }
    });
    
    return issues;
  };

  return (
    <div className="p-4">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-xl font-bold">Количество обещаний по дням (monitor_deadline_at)</h2>
        <RegionFilter 
          regions={REGION_IDS} 
          selectedRegions={selectedRegions} 
          onChange={handleRegionFilterChange} 
        />
      </div>

      <ResponsiveContainer width="100%" height={400}>
        <LineChart data={chartData} onClick={handleDateClick}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="date" />
          <YAxis allowDecimals={false} />
          <Tooltip 
            formatter={(value, name) => {
              if (name === "total") return ["Всего", value];
              return [REGION_IDS[name] || name, value];
            }}
          />
          <Legend 
            formatter={(value) => {
              if (value === "total") return "Всего";
              return REGION_IDS[value] || value;
            }}
          />
          
          {/* Отображаем линию для всего округа если выбран "Весь округ" */}
          {selectedRegions.includes("all") && (
            <Line 
              type="monotone" 
              dataKey="total" 
              stroke="#000000" 
              strokeWidth={2} 
              name="total"
            />
          )}
          
          {/* Отображаем линии для выбранных районов */}
          {Object.keys(REGION_IDS).map((regionId, index) => (
            selectedRegions.includes(regionId) && (
              <Line 
                key={regionId}
                type="monotone" 
                dataKey={regionId} 
                stroke={COLORS[index % COLORS.length]} 
                strokeWidth={1.5} 
                name={regionId}
              />
            )
          ))}
          
          <ReferenceLine x={todayStr} stroke="red" label="Сегодня" strokeDasharray="3 3" />
        </LineChart>
      </ResponsiveContainer>

      {selectedDate && (
        <div className="mt-4">
          <h3 className="text-lg font-semibold mb-2">Заявки на {selectedDate}:</h3>
          {getFilteredIssuesForDate(selectedDate).length > 0 ? (
            <ul className="space-y-2">
              {getFilteredIssuesForDate(selectedDate).map((issue) => (
                <li key={issue.id}>
                  <button
                    onClick={() => handleIdClick(issue)}
                    className="text-blue-600 underline hover:text-blue-800"
                  >
                    ID {issue.id} — {getRegionName(issue.region_id)}
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <div>Нет заявок для выбранных районов на эту дату</div>
          )}
        </div>
      )}

      {selectedIssue && (
        <Modal onClose={() => setSelectedIssue(null)}>
          <div className="space-y-2 text-sm">
            <div><b>Сообщение:</b> {selectedIssue.id}</div>
            <div><b>Тема:</b> {selectedIssue.theme?.title}</div>
            <div><b>Статус:</b> {selectedIssue.status?.title}</div>
            <div><b>Район:</b> {getRegionName(selectedIssue.region_id)}</div>
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