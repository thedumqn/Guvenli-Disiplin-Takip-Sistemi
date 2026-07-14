import React, { useState, useEffect } from 'react';
import { 
  FileText, Plus, Search, Edit, Trash2, Eye, 
  ChevronLeft, ChevronRight, X, AlertTriangle,
  Calendar, MapPin, User, Clock, CheckCircle, XCircle
} from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../services/api';

const DisciplinaryPage = () => {
  const [records, setRecords] = useState([]);
  const [students, setStudents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [pagination, setPagination] = useState({ page: 1, pages: 1, total: 0 });
  
  const [showModal, setShowModal] = useState(false);
  const [showViewModal, setShowViewModal] = useState(false);
  const [modalMode, setModalMode] = useState('create');
  const [selectedRecord, setSelectedRecord] = useState(null);
  
  const [formData, setFormData] = useState({
    student: '',
    incidentDate: '',
    incidentLocation: '',
    incidentDescription: '',
    violatedArticle: '',
    penaltyType: 'uyari',
    decisionNumber: '',
    decisionDate: '',
    decisionBody: 'fakulte_yonetim_kurulu',
    penaltyStartDate: '',
    penaltyEndDate: '',
    internalNotes: ''
  });

  const penaltyTypes = [
    { value: 'uyari', label: 'Uyarı', severity: 'low' },
    { value: 'kinama', label: 'Kınama', severity: 'low' },
    { value: 'uzaklastirma_1_hafta', label: '1 Hafta Uzaklaştırma', severity: 'medium' },
    { value: 'uzaklastirma_2_hafta', label: '2 Hafta Uzaklaştırma', severity: 'medium' },
    { value: 'uzaklastirma_1_ay', label: '1 Ay Uzaklaştırma', severity: 'high' },
    { value: 'uzaklastirma_1_donem', label: '1 Dönem Uzaklaştırma', severity: 'high' },
    { value: 'uzaklastirma_2_donem', label: '2 Dönem Uzaklaştırma', severity: 'critical' },
    { value: 'cikarma', label: 'Yükseköğretimden Çıkarma', severity: 'critical' }
  ];

  const decisionBodies = [
    { value: 'fakulte_yonetim_kurulu', label: 'Fakülte Yönetim Kurulu' },
    { value: 'universite_yonetim_kurulu', label: 'Üniversite Yönetim Kurulu' },
    { value: 'disiplin_kurulu', label: 'Disiplin Kurulu' }
  ];

  const statusOptions = [
    { value: 'taslak', label: 'Taslak', color: 'gray' },
    { value: 'beklemede', label: 'Beklemede', color: 'yellow' },
    { value: 'onaylandi', label: 'Onaylandı', color: 'green' },
    { value: 'itiraz_edildi', label: 'İtiraz Edildi', color: 'orange' },
    { value: 'iptal_edildi', label: 'İptal Edildi', color: 'red' },
    { value: 'tamamlandi', label: 'Tamamlandı', color: 'blue' }
  ];

  useEffect(() => {
    fetchRecords();
    fetchStudents();
  }, [pagination.page, search, statusFilter]);

  const fetchRecords = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams({
        page: pagination.page,
        limit: 10,
        ...(search && { search }),
        ...(statusFilter && { status: statusFilter })
      });
      const response = await api.get(`/disciplinary?${params}`);
      setRecords(response.data.data || []);
      setPagination(prev => ({
        ...prev,
        pages: response.data.pagination?.pages || 1,
        total: response.data.pagination?.total || 0
      }));
    } catch (error) {
      toast.error('Kayıtlar yüklenirken hata oluştu');
    } finally {
      setLoading(false);
    }
  };

  const fetchStudents = async () => {
    try {
      const response = await api.get('/students?limit=100');
      setStudents(response.data.data || []);
    } catch (error) {
      console.error('Öğrenciler yüklenemedi');
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      if (modalMode === 'create') {
        await api.post('/disciplinary', formData);
        toast.success('Disiplin kaydı oluşturuldu');
      } else {
        await api.put(`/disciplinary/${selectedRecord._id}`, formData);
        toast.success('Kayıt güncellendi');
      }
      setShowModal(false);
      resetForm();
      fetchRecords();
    } catch (error) {
      toast.error(error.response?.data?.message || 'İşlem başarısız');
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Bu kaydı silmek istediğinize emin misiniz?')) return;
    
    try {
      await api.delete(`/disciplinary/${id}`);
      toast.success('Kayıt silindi');
      fetchRecords();
    } catch (error) {
      toast.error('Silme işlemi başarısız');
    }
  };

  const handleStatusChange = async (id, newStatus) => {
    try {
      await api.patch(`/disciplinary/${id}/status`, { status: newStatus });
      toast.success('Durum güncellendi');
      fetchRecords();
    } catch (error) {
      toast.error('Durum güncellenemedi');
    }
  };

  const openCreateModal = () => {
    setModalMode('create');
    resetForm();
    setShowModal(true);
  };

  const openEditModal = (record) => {
    setModalMode('edit');
    setSelectedRecord(record);
    setFormData({
      student: record.student?._id || record.student,
      incidentDate: record.incidentDate?.split('T')[0] || '',
      incidentLocation: record.incidentLocation,
      incidentDescription: record.incidentDescription,
      violatedArticle: record.violatedArticle,
      penaltyType: record.penaltyType,
      decisionNumber: record.decisionNumber,
      decisionDate: record.decisionDate?.split('T')[0] || '',
      decisionBody: record.decisionBody,
      penaltyStartDate: record.penaltyStartDate?.split('T')[0] || '',
      penaltyEndDate: record.penaltyEndDate?.split('T')[0] || '',
      internalNotes: record.internalNotes || ''
    });
    setShowModal(true);
  };

  const openViewModal = (record) => {
    setSelectedRecord(record);
    setShowViewModal(true);
  };

  const resetForm = () => {
    setFormData({
      student: '',
      incidentDate: '',
      incidentLocation: '',
      incidentDescription: '',
      violatedArticle: '',
      penaltyType: 'uyari',
      decisionNumber: '',
      decisionDate: '',
      decisionBody: 'fakulte_yonetim_kurulu',
      penaltyStartDate: '',
      penaltyEndDate: '',
      internalNotes: ''
    });
    setSelectedRecord(null);
  };

  const getStatusBadge = (status) => {
    const option = statusOptions.find(s => s.value === status);
    const colors = {
      gray: 'bg-gray-100 text-gray-800',
      yellow: 'bg-yellow-100 text-yellow-800',
      green: 'bg-green-100 text-green-800',
      orange: 'bg-orange-100 text-orange-800',
      red: 'bg-red-100 text-red-800',
      blue: 'bg-blue-100 text-blue-800'
    };
    return (
      <span className={`px-2 py-1 text-xs font-medium rounded-full ${colors[option?.color || 'gray']}`}>
        {option?.label || status}
      </span>
    );
  };

  const getPenaltySeverityColor = (penaltyType) => {
    const penalty = penaltyTypes.find(p => p.value === penaltyType);
    const colors = {
      low: 'text-yellow-600 bg-yellow-50',
      medium: 'text-orange-600 bg-orange-50',
      high: 'text-red-600 bg-red-50',
      critical: 'text-red-800 bg-red-100'
    };
    return colors[penalty?.severity || 'low'];
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Disiplin Kayıtları</h1>
          <p className="text-gray-600">Toplam {pagination.total} kayıt</p>
        </div>
        <button
          onClick={openCreateModal}
          className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
        >
          <Plus className="w-5 h-5 mr-2" />
          Yeni Kayıt
        </button>
      </div>

      <div className="flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
          <input
            type="text"
            placeholder="Kayıt numarası veya öğrenci ara..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
        >
          <option value="">Tüm Durumlar</option>
          {statusOptions.map(s => (
            <option key={s.value} value={s.value}>{s.label}</option>
          ))}
        </select>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Kayıt No</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Öğrenci</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Ceza</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Olay Tarihi</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Durum</th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">İşlemler</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {loading ? (
                <tr>
                  <td colSpan="6" className="px-6 py-12 text-center">
                    <div className="loading-spinner mx-auto"></div>
                  </td>
                </tr>
              ) : records.length === 0 ? (
                <tr>
                  <td colSpan="6" className="px-6 py-12 text-center text-gray-500">
                    Kayıt bulunamadı
                  </td>
                </tr>
              ) : (
                records.map((record) => (
                  <tr key={record._id} className="hover:bg-gray-50">
                    <td className="px-6 py-4">
                      <span className="font-mono text-sm font-medium text-gray-900">
                        {record.recordNumber}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <div>
                        <p className="font-medium text-gray-900">
                          {record.student?.firstName} {record.student?.lastName}
                        </p>
                        <p className="text-sm text-gray-500">{record.student?.studentNumber}</p>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className={`px-2 py-1 text-xs font-medium rounded ${getPenaltySeverityColor(record.penaltyType)}`}>
                        {penaltyTypes.find(p => p.value === record.penaltyType)?.label}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-gray-600">
                      {new Date(record.incidentDate).toLocaleDateString('tr-TR')}
                    </td>
                    <td className="px-6 py-4">{getStatusBadge(record.status)}</td>
                    <td className="px-6 py-4 text-right space-x-2">
                      <button
                        onClick={() => openViewModal(record)}
                        className="p-2 text-gray-600 hover:text-blue-600 hover:bg-blue-50 rounded-lg"
                      >
                        <Eye className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => openEditModal(record)}
                        className="p-2 text-gray-600 hover:text-yellow-600 hover:bg-yellow-50 rounded-lg"
                      >
                        <Edit className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleDelete(record._id)}
                        className="p-2 text-gray-600 hover:text-red-600 hover:bg-red-50 rounded-lg"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {pagination.pages > 1 && (
          <div className="px-6 py-4 border-t border-gray-200 flex items-center justify-between">
            <p className="text-sm text-gray-600">Sayfa {pagination.page} / {pagination.pages}</p>
            <div className="flex gap-2">
              <button
                onClick={() => setPagination(p => ({ ...p, page: p.page - 1 }))}
                disabled={pagination.page === 1}
                className="p-2 border rounded-lg disabled:opacity-50"
              >
                <ChevronLeft className="w-5 h-5" />
              </button>
              <button
                onClick={() => setPagination(p => ({ ...p, page: p.page + 1 }))}
                disabled={pagination.page === pagination.pages}
                className="p-2 border rounded-lg disabled:opacity-50"
              >
                <ChevronRight className="w-5 h-5" />
              </button>
            </div>
          </div>
        )}
      </div>

      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl max-w-3xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-gray-200 flex items-center justify-between">
              <h2 className="text-xl font-bold text-gray-900">
                {modalMode === 'create' ? 'Yeni Disiplin Kaydı' : 'Kayıt Düzenle'}
              </h2>
              <button onClick={() => setShowModal(false)} className="p-2 hover:bg-gray-100 rounded-lg">
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Öğrenci *</label>
                <select
                  value={formData.student}
                  onChange={(e) => setFormData({ ...formData, student: e.target.value })}
                  required
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">Öğrenci Seçiniz</option>
                  {students.map(s => (
                    <option key={s._id} value={s._id}>
                      {s.studentNumber} - {s.firstName} {s.lastName}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Olay Tarihi *</label>
                  <input
                    type="date"
                    value={formData.incidentDate}
                    onChange={(e) => setFormData({ ...formData, incidentDate: e.target.value })}
                    required
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Olay Yeri *</label>
                  <input
                    type="text"
                    value={formData.incidentLocation}
                    onChange={(e) => setFormData({ ...formData, incidentLocation: e.target.value })}
                    required
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    placeholder="Örn: Kütüphane, Yemekhane..."
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Olay Açıklaması *</label>
                <textarea
                  value={formData.incidentDescription}
                  onChange={(e) => setFormData({ ...formData, incidentDescription: e.target.value })}
                  required
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  placeholder="Olayı detaylı olarak açıklayınız..."
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">İhlal Edilen Madde *</label>
                <input
                  type="text"
                  value={formData.violatedArticle}
                  onChange={(e) => setFormData({ ...formData, violatedArticle: e.target.value })}
                  required
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  placeholder="Örn: Yönetmelik Madde 5/a"
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Ceza Türü *</label>
                  <select
                    value={formData.penaltyType}
                    onChange={(e) => setFormData({ ...formData, penaltyType: e.target.value })}
                    required
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  >
                    {penaltyTypes.map(p => (
                      <option key={p.value} value={p.value}>{p.label}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Karar Organı *</label>
                  <select
                    value={formData.decisionBody}
                    onChange={(e) => setFormData({ ...formData, decisionBody: e.target.value })}
                    required
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  >
                    {decisionBodies.map(d => (
                      <option key={d.value} value={d.value}>{d.label}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Karar Numarası *</label>
                  <input
                    type="text"
                    value={formData.decisionNumber}
                    onChange={(e) => setFormData({ ...formData, decisionNumber: e.target.value })}
                    required
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    placeholder="2024/001"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Karar Tarihi *</label>
                  <input
                    type="date"
                    value={formData.decisionDate}
                    onChange={(e) => setFormData({ ...formData, decisionDate: e.target.value })}
                    required
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Ceza Başlangıç Tarihi</label>
                  <input
                    type="date"
                    value={formData.penaltyStartDate}
                    onChange={(e) => setFormData({ ...formData, penaltyStartDate: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Ceza Bitiş Tarihi</label>
                  <input
                    type="date"
                    value={formData.penaltyEndDate}
                    onChange={(e) => setFormData({ ...formData, penaltyEndDate: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">İç Notlar</label>
                <textarea
                  value={formData.internalNotes}
                  onChange={(e) => setFormData({ ...formData, internalNotes: e.target.value })}
                  rows={2}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  placeholder="Sadece sistem kullanıcıları görebilir..."
                />
              </div>

              <div className="flex justify-end gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
                >
                  İptal
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                >
                  {modalMode === 'create' ? 'Oluştur' : 'Güncelle'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showViewModal && selectedRecord && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-gray-200 flex items-center justify-between">
              <div>
                <h2 className="text-xl font-bold text-gray-900">Disiplin Kaydı Detayı</h2>
                <p className="text-sm text-gray-500 font-mono">{selectedRecord.recordNumber}</p>
              </div>
              <button onClick={() => setShowViewModal(false)} className="p-2 hover:bg-gray-100 rounded-lg">
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <div className="p-6 space-y-6">
              <div className="flex items-center gap-4 p-4 bg-gray-50 rounded-lg">
                <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center">
                  <User className="w-6 h-6 text-blue-600" />
                </div>
                <div>
                  <p className="font-medium text-gray-900">
                    {selectedRecord.student?.firstName} {selectedRecord.student?.lastName}
                  </p>
                  <p className="text-sm text-gray-500">{selectedRecord.student?.studentNumber}</p>
                </div>
              </div>

              <div className="space-y-3">
                <h3 className="font-semibold text-gray-900">Olay Bilgileri</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div className="flex items-center gap-2 text-gray-600">
                    <Calendar className="w-4 h-4" />
                    <span>{new Date(selectedRecord.incidentDate).toLocaleDateString('tr-TR')}</span>
                  </div>
                  <div className="flex items-center gap-2 text-gray-600">
                    <MapPin className="w-4 h-4" />
                    <span>{selectedRecord.incidentLocation}</span>
                  </div>
                </div>
                <p className="text-gray-700 bg-gray-50 p-3 rounded-lg">{selectedRecord.incidentDescription}</p>
              </div>

              <div className="space-y-3">
                <h3 className="font-semibold text-gray-900">Ceza Bilgileri</h3>
                <div className="flex items-center gap-2">
                  <AlertTriangle className="w-5 h-5 text-orange-500" />
                  <span className={`px-3 py-1 rounded-full text-sm font-medium ${getPenaltySeverityColor(selectedRecord.penaltyType)}`}>
                    {penaltyTypes.find(p => p.value === selectedRecord.penaltyType)?.label}
                  </span>
                </div>
                <p className="text-sm text-gray-600">
                  <strong>İhlal Edilen Madde:</strong> {selectedRecord.violatedArticle}
                </p>
              </div>

              <div className="space-y-3">
                <h3 className="font-semibold text-gray-900">Karar Bilgileri</h3>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <p className="text-gray-500">Karar Numarası</p>
                    <p className="font-medium">{selectedRecord.decisionNumber}</p>
                  </div>
                  <div>
                    <p className="text-gray-500">Karar Tarihi</p>
                    <p className="font-medium">{new Date(selectedRecord.decisionDate).toLocaleDateString('tr-TR')}</p>
                  </div>
                  <div>
                    <p className="text-gray-500">Karar Organı</p>
                    <p className="font-medium">
                      {decisionBodies.find(d => d.value === selectedRecord.decisionBody)?.label}
                    </p>
                  </div>
                  <div>
                    <p className="text-gray-500">Durum</p>
                    {getStatusBadge(selectedRecord.status)}
                  </div>
                </div>
              </div>

              <div className="pt-4 border-t">
                <label className="block text-sm font-medium text-gray-700 mb-2">Durum Değiştir</label>
                <div className="flex gap-2 flex-wrap">
                  {statusOptions.map(s => (
                    <button
                      key={s.value}
                      onClick={() => {
                        handleStatusChange(selectedRecord._id, s.value);
                        setShowViewModal(false);
                      }}
                      disabled={selectedRecord.status === s.value}
                      className={`px-3 py-1 text-sm rounded-full border transition-colors
                        ${selectedRecord.status === s.value 
                          ? 'bg-gray-100 text-gray-400 cursor-not-allowed' 
                          : 'hover:bg-gray-100'}`}
                    >
                      {s.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default DisciplinaryPage;