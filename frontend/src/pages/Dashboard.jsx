import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { disciplinaryAPI, studentAPI } from '../services/api';
import {
  Users,
  FileText,
  AlertTriangle,
  CheckCircle,
  Clock,
  TrendingUp,
  ArrowRight
} from 'lucide-react';

const Dashboard = () => {
  const { user } = useAuth();
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const response = await disciplinaryAPI.getStats();
        setStats(response.data.data);
      } catch (error) {
        console.error('İstatistik hatası:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchStats();
  }, []);

  const statCards = [
    {
      title: 'Toplam Kayıt',
      value: stats?.totalRecords || 0,
      icon: FileText,
      color: 'bg-blue-500',
      change: '+12%'
    },
    {
      title: 'Bekleyen',
      value: stats?.byStatus?.beklemede || 0,
      icon: Clock,
      color: 'bg-yellow-500',
      change: '3 yeni'
    },
    {
      title: 'Onaylanan',
      value: stats?.byStatus?.onaylandi || 0,
      icon: CheckCircle,
      color: 'bg-green-500',
      change: '+5%'
    },
    {
      title: 'İtiraz Edilen',
      value: stats?.byStatus?.itiraz_edildi || 0,
      icon: AlertTriangle,
      color: 'bg-red-500',
      change: '2 aktif'
    }
  ];

  const penaltyLabels = {
    uyari: 'Uyarı',
    kinama: 'Kınama',
    uzaklastirma_1_hafta: '1 Hafta Uzaklaştırma',
    uzaklastirma_2_hafta: '2 Hafta Uzaklaştırma',
    uzaklastirma_1_ay: '1 Ay Uzaklaştırma',
    uzaklastirma_1_donem: '1 Dönem Uzaklaştırma',
    uzaklastirma_2_donem: '2 Dönem Uzaklaştırma',
    cikarma: 'Çıkarma'
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="loading-spinner" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="bg-gradient-to-r from-blue-600 to-blue-800 rounded-2xl p-6 text-white">
        <h1 className="text-2xl font-bold">
          Hoş geldiniz, {user?.firstName}!
        </h1>
        <p className="mt-1 text-blue-100">
          Disiplin İşleri Takip Sistemi kontrol panelinize hoş geldiniz.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {statCards.map((card, index) => {
          const Icon = card.icon;
          return (
            <div key={index} className="bg-white rounded-xl shadow-sm p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-gray-500 text-sm">{card.title}</p>
                  <p className="text-3xl font-bold mt-1">{card.value}</p>
                  <p className="text-sm text-gray-400 mt-1">{card.change}</p>
                </div>
                <div className={`${card.color} p-3 rounded-xl`}>
                  <Icon className="w-6 h-6 text-white" />
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-xl shadow-sm p-6">
          <h3 className="text-lg font-semibold mb-4">Ceza Dağılımı</h3>
          <div className="space-y-4">
            {stats?.byPenaltyType && Object.entries(stats.byPenaltyType).map(([type, count]) => {
              const total = stats.totalRecords || 1;
              const percentage = Math.round((count / total) * 100);
              return (
                <div key={type}>
                  <div className="flex justify-between text-sm mb-1">
                    <span className="text-gray-600">{penaltyLabels[type] || type}</span>
                    <span className="font-medium">{count} ({percentage}%)</span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div
                      className="bg-blue-600 h-2 rounded-full transition-all duration-500"
                      style={{ width: `${percentage}%` }}
                    />
                  </div>
                </div>
              );
            })}
            {(!stats?.byPenaltyType || Object.keys(stats.byPenaltyType).length === 0) && (
              <p className="text-gray-500 text-center py-4">Henüz kayıt bulunmuyor</p>
            )}
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm p-6">
          <h3 className="text-lg font-semibold mb-4">Aylık Trend</h3>
          <div className="space-y-3">
            {stats?.monthlyTrend?.slice(0, 6).map((item, index) => {
              const monthNames = ['Oca', 'Şub', 'Mar', 'Nis', 'May', 'Haz', 
                                   'Tem', 'Ağu', 'Eyl', 'Eki', 'Kas', 'Ara'];
              return (
                <div key={index} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                  <span className="text-gray-600">
                    {monthNames[item.month - 1]} {item.year}
                  </span>
                  <div className="flex items-center">
                    <span className="font-semibold mr-2">{item.count}</span>
                    <TrendingUp className="w-4 h-4 text-green-500" />
                  </div>
                </div>
              );
            })}
            {(!stats?.monthlyTrend || stats.monthlyTrend.length === 0) && (
              <p className="text-gray-500 text-center py-4">Henüz veri bulunmuyor</p>
            )}
          </div>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm p-6">
        <h3 className="text-lg font-semibold mb-4">Hızlı İşlemler</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Link
            to="/disciplinary/new"
            className="flex items-center justify-between p-4 bg-blue-50 rounded-lg hover:bg-blue-100 transition-colors"
          >
            <div className="flex items-center">
              <FileText className="w-5 h-5 text-blue-600 mr-3" />
              <span className="font-medium text-blue-900">Yeni Disiplin Kaydı</span>
            </div>
            <ArrowRight className="w-5 h-5 text-blue-600" />
          </Link>
          
          <Link
            to="/students"
            className="flex items-center justify-between p-4 bg-green-50 rounded-lg hover:bg-green-100 transition-colors"
          >
            <div className="flex items-center">
              <Users className="w-5 h-5 text-green-600 mr-3" />
              <span className="font-medium text-green-900">Öğrenci Listesi</span>
            </div>
            <ArrowRight className="w-5 h-5 text-green-600" />
          </Link>
          
          <Link
            to="/disciplinary?status=beklemede"
            className="flex items-center justify-between p-4 bg-yellow-50 rounded-lg hover:bg-yellow-100 transition-colors"
          >
            <div className="flex items-center">
              <Clock className="w-5 h-5 text-yellow-600 mr-3" />
              <span className="font-medium text-yellow-900">Bekleyen Kayıtlar</span>
            </div>
            <ArrowRight className="w-5 h-5 text-yellow-600" />
          </Link>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
