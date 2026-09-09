import { createBrowserRouter, Navigate, Outlet } from "react-router-dom";
import SurfaceSwitcher from "../shell/SurfaceSwitcher";
import PhoneFrame from "../shell/PhoneFrame";
import TodayList from "../surfaces/asha/TodayList";
import FamilyDetail from "../surfaces/asha/FamilyDetail";
import SymptomCheck from "../surfaces/asha/SymptomCheck";
import Result from "../surfaces/asha/Result";
import Booking from "../surfaces/asha/Booking";
import Booked from "../surfaces/asha/Booked";
import SyncBanner from "../surfaces/asha/SyncBanner";
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
          <PhoneFrame>
            <SyncBanner />
            <Outlet />
          </PhoneFrame>
        ),
        children: [
          { index: true, element: <TodayList /> },
          { path: "family/:familyId", element: <FamilyDetail /> },
          { path: "family/:familyId/check/:memberId", element: <SymptomCheck /> },
          { path: "family/:familyId/check/:memberId/result", element: <Result /> },
          { path: "family/:familyId/check/:memberId/booking", element: <Booking /> },
          { path: "booked/:bookingId", element: <Booked /> },
        ],
      },
      { path: "voice", element: <CallSimulator /> },
      { path: "phc", element: <Dashboard /> },
      { path: "*", element: <Navigate to="/asha" replace /> },
    ],
  },
]);
