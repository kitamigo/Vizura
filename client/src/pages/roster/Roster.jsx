import { ScheduleComponent, Day, Week, Month, Agenda, Inject } from '@syncfusion/ej2-react-schedule';
import './Roster.css';


function Roster () {
  const data = [ // Filler meeting for example
    {
      Id: 1,
      Subject: 'Meeting - 1',
      StartTime: new Date(new Date().setHours(9,0,0)),
      EndTime: new Date(new Date().setHours(10,0,0)),
    }
  ];

  const eventSettings = { dataSource: data };

  return (
    <ScheduleComponent
      cssClass="roster-position"
      width="calc(80vw - 250px)"
      height="75vh"
      currentView="Week"
      views={['Day', 'Week', 'Month', 'Agenda']}
      eventSettings={eventSettings}
    >
      <Inject services={[Day, Week, Month, Agenda]} />
    </ScheduleComponent>
  );
};

export default Roster;
