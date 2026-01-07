import { createClient } from '@/lib/supabase/server';
import {
  Phone,
  PhoneMissed,
  FileText,
  Users,
  TrendingUp,
  Clock,
  AlertCircle,
  CheckCircle2,
} from 'lucide-react';

const stats = [
  { name: 'Calls Today', value: '47', change: '+12%', icon: Phone, color: 'bg-blue-500' },
  { name: 'Missed Calls', value: '3', change: '-25%', icon: PhoneMissed, color: 'bg-red-500' },
  { name: 'Quotes Pending', value: '12', change: '+8%', icon: FileText, color: 'bg-amber-500' },
  { name: 'New Customers', value: '8', change: '+15%', icon: Users, color: 'bg-emerald-500' },
];

const triageItems = [
  { id: 1, type: 'call', title: 'Return call - John Smith', priority: 'high', time: '10 min ago', customer: 'John Smith' },
  { id: 2, type: 'quote', title: 'Quote follow-up needed', priority: 'medium', time: '25 min ago', customer: 'Sarah Johnson' },
  { id: 3, type: 'service', title: 'Policy change request', priority: 'low', time: '1 hour ago', customer: 'Mike Brown' },
  { id: 4, type: 'claim', title: 'Claim status inquiry', priority: 'high', time: '2 hours ago', customer: 'Lisa Davis' },
];

const recentCalls = [
  { id: 1, customer: 'John Smith', duration: '4:32', time: '10:30 AM', type: 'inbound', sentiment: 'positive' },
  { id: 2, customer: 'Sarah Johnson', duration: '8:15', time: '10:15 AM', type: 'outbound', sentiment: 'neutral' },
  { id: 3, customer: 'Mike Brown', duration: '2:45', time: '9:55 AM', type: 'inbound', sentiment: 'positive' },
  { id: 4, customer: 'Lisa Davis', duration: '12:03', time: '9:30 AM', type: 'inbound', sentiment: 'negative' },
];

export default async function DashboardPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  return (
    <div className="space-y-6">
      {/* Welcome Header */}
      <div className="bg-white rounded-lg shadow-sm p-6">
        <h1 className="text-2xl font-bold text-gray-900">
          Good morning! 👋
        </h1>
        <p className="text-gray-600 mt-1">
          Here's what's happening with your agency today.
        </p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {stats.map((stat) => (
          <div
            key={stat.name}
            className="bg-white rounded-lg shadow-sm p-6 flex items-center gap-4"
          >
            <div className={`${stat.color} rounded-lg p-3`}>
              <stat.icon className="h-6 w-6 text-white" />
            </div>
            <div>
              <p className="text-sm font-medium text-gray-600">{stat.name}</p>
              <div className="flex items-baseline gap-2">
                <p className="text-2xl font-semibold text-gray-900">{stat.value}</p>
                <span className={`text-xs font-medium ${
                  stat.change.startsWith('+') ? 'text-emerald-600' : 'text-red-600'
                }`}>
                  {stat.change}
                </span>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Two Column Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Triage Queue */}
        <div className="bg-white rounded-lg shadow-sm">
          <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
            <h2 className="text-lg font-semibold text-gray-900">Triage Queue</h2>
            <a href="/triage" className="text-sm text-emerald-600 hover:text-emerald-700 font-medium">
              View all →
            </a>
          </div>
          <div className="divide-y divide-gray-100">
            {triageItems.map((item) => (
              <div key={item.id} className="px-6 py-4 flex items-center gap-4 hover:bg-gray-50">
                <div className={`h-2 w-2 rounded-full ${
                  item.priority === 'high' ? 'bg-red-500' :
                  item.priority === 'medium' ? 'bg-amber-500' : 'bg-gray-400'
                }`} />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900 truncate">{item.title}</p>
                  <p className="text-xs text-gray-500">{item.customer}</p>
                </div>
                <div className="flex items-center gap-2 text-xs text-gray-500">
                  <Clock className="h-3 w-3" />
                  {item.time}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Recent Calls */}
        <div className="bg-white rounded-lg shadow-sm">
          <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
            <h2 className="text-lg font-semibold text-gray-900">Recent Calls</h2>
            <a href="/calls" className="text-sm text-emerald-600 hover:text-emerald-700 font-medium">
              View all →
            </a>
          </div>
          <div className="divide-y divide-gray-100">
            {recentCalls.map((call) => (
              <div key={call.id} className="px-6 py-4 flex items-center gap-4 hover:bg-gray-50">
                <div className={`h-8 w-8 rounded-full flex items-center justify-center ${
                  call.type === 'inbound' ? 'bg-blue-100' : 'bg-emerald-100'
                }`}>
                  <Phone className={`h-4 w-4 ${
                    call.type === 'inbound' ? 'text-blue-600' : 'text-emerald-600'
                  }`} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900">{call.customer}</p>
                  <p className="text-xs text-gray-500">{call.duration} • {call.time}</p>
                </div>
                <div className={`h-6 w-6 rounded-full flex items-center justify-center ${
                  call.sentiment === 'positive' ? 'bg-emerald-100 text-emerald-600' :
                  call.sentiment === 'negative' ? 'bg-red-100 text-red-600' :
                  'bg-gray-100 text-gray-600'
                }`}>
                  {call.sentiment === 'positive' ? '😊' :
                   call.sentiment === 'negative' ? '😟' : '😐'}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* AI Morning Briefing */}
      <div className="bg-gradient-to-r from-emerald-500 to-teal-600 rounded-lg shadow-sm p-6 text-white">
        <div className="flex items-start gap-4">
          <div className="h-10 w-10 rounded-lg bg-white/20 flex items-center justify-center">
            <TrendingUp className="h-5 w-5" />
          </div>
          <div>
            <h3 className="text-lg font-semibold">AI Morning Briefing</h3>
            <p className="mt-2 text-emerald-50 text-sm leading-relaxed">
              Today looks busy! You have <strong>12 policies renewing this week</strong> that need attention. 
              3 customers have been flagged as <strong>potential churn risks</strong> based on recent interactions. 
              The Smith family quote from yesterday should be followed up — they seemed very interested in bundling their auto and home.
            </p>
            <button className="mt-4 text-sm font-medium text-white/90 hover:text-white">
              View full briefing →
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
