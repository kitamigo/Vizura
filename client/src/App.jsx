import { ScheduleComponent, Day, Week, WorkWeek, Month, Agenda, Inject } from '@syncfusion/ej2-react-schedule';
import './App.css';


function App () {
  const data = [ // Filler meeting for example
    {
      Id: 1,
      Subject: 'Meeting - 1',
      StartTime: new Date(new Date().setHours(9,0,0)),
      EndTime: new Date(new Date().setHours(10,0,0)),
    }
  ];

  const eventSettings = { dataSource: data };

  function Button () {
  };

  return (
    <ScheduleComponent eventSettings={eventSettings} width="80vw" height="80vh" className="roster-positon">
      <Inject services={[Day, Week, WorkWeek, Month, Agenda]} />
    </ScheduleComponent>
  );
};

export default App;