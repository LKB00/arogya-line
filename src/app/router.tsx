import { createBrowserRouter, Navigate, Outlet } from "react-router-dom";
import SurfaceSwitcher from "../shell/SurfaceSwitcher";
import PhoneFrame from "../shell/PhoneFrame";
import TodayList from "../surfaces/asha/TodayList";
import FamilyPicker from "../surfaces/asha/FamilyPicker";
import FamilyDetail from "../surfaces/asha/FamilyDetail";
import SymptomCheck from "../surfaces/asha/SymptomCheck";
import Result from "../surfaces/asha/Result";
import Booking from "../surfaces/asha/Booking";
import Booked from "../surfaces/asha/Booked";
import TopBar from "../surfaces/asha/TopBar";
import CallSimulator from "../surfaces/voice/CallSimulator";
import Dashboard from "../surfaces/phc/Dashboard";

export const router = createBrowserRouter([
  {
    path: "/",
    element: <SurfaceSwitcher />,
    children: [
      { index: true, element: <Navigate to="/asha" replace /> },
      {
        path: "asha",
        // Every ASHA screen sits under the sync banner.
        element: (
          <PhoneFrame variant="asha">
            <TopBar />
            <Outlet />
          </PhoneFrame>
        ),
        children: [
          { index: true, element: <TodayList />, handle: { own: true } },
          { path: "families", element: <FamilyPicker />, handle: { back: "today" } },
          // `handle.back` tells the TopBar where this screen goes back to.
          { path: "family/:familyId", element: <FamilyDetail />, handle: { back: "today" } },
          { path: "family/:familyId/check/:memberId", element: <SymptomCheck />, handle: { back: "family", own: true } },
          { path: "family/:familyId/check/:memberId/result", element: <Result />, handle: { back: "family", own: true } },
          { path: "family/:familyId/check/:memberId/booking", element: <Booking />, handle: { back: "result" } },
          { path: "booked/:bookingId", element: <Booked />, handle: { own: true } },
        ],
      },
      { path: "voice", element: <CallSimulator /> },
      { path: "phc", element: <Dashboard /> },
      { path: "*", element: <Navigate to="/asha" replace /> },
    ],
  },
]);
