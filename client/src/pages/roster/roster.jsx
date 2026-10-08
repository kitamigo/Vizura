import * as ReactDOM from 'react-dom';
import * as React from 'react';
import { ScheduleComponent, ViewDirective, Resize, DragAndDrop, Day, Week, Month, Agenda, Inject } from '@syncfusion/ej2-react-schedule';
import './roster.css';


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

  function Button () {
  };

  return (
    <ScheduleComponent cssClass="roster-position" eventSettings={eventSettings} >
      <Inject services={[Day, Week, Month, Agenda]} />
    </ScheduleComponent>
  );
};

export default Roster;