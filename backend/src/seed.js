require('dotenv').config();
const mongoose = require('mongoose');
const { User, Student, DisciplinaryRecord } = require('./models');

const seedData = async () => {
    try {
        await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/disiplin_db');
        console.log('MongoDB bağlantısı başarılı');
        
        if (process.env.NODE_ENV === 'development') {
            await User.deleteMany({});
            await Student.deleteMany({});
            await DisciplinaryRecord.deleteMany({});
            console.log('Mevcut veriler temizlendi');
        }
        
        const admin = await User.create({
            tcKimlik: '10000000146', // Geçerli TC formatında
            email: 'admin@disiplin.edu.tr',
            password: 'Admin123!@#456', // Güçlü şifre
            firstName: 'Sistem',
            lastName: 'Yöneticisi',
            role: 'admin',
            permissions: [
                'create_record', 'read_record', 'update_record', 'delete_record',
                'manage_users', 'view_audit_logs', 'export_data', 'manage_students'
            ],
            isActive: true,
            isEmailVerified: true
        });
        console.log('Admin kullanıcısı oluşturuldu:', admin.email);
        
        const kurulUyesi = await User.create({
            tcKimlik: '10000000228',
            email: 'kurul@disiplin.edu.tr',
            password: 'Kurul123!@#456',
            firstName: 'Ahmet',
            lastName: 'Yılmaz',
            role: 'kurul_uyesi',
            permissions: ['create_record', 'read_record', 'update_record'],
            isActive: true,
            isEmailVerified: true
        });
        console.log('Kurul üyesi oluşturuldu:', kurulUyesi.email);
        
        const ogrenciIsleri = await User.create({
            tcKimlik: '10000000302',
            email: 'ogrenciisleri@disiplin.edu.tr',
            password: 'Ogrenci123!@#456',
            firstName: 'Fatma',
            lastName: 'Demir',
            role: 'ogrenci_isleri',
            permissions: ['read_record', 'manage_students'],
            isActive: true,
            isEmailVerified: true
        });
        console.log('Öğrenci işleri personeli oluşturuldu:', ogrenciIsleri.email);
        
        const students = await Student.create([
            {
                studentNumber: '202001001',
                tcKimlik: '10000000384',
                firstName: 'Mehmet',
                lastName: 'Kaya',
                email: 'mehmet.kaya@ogrenci.edu.tr',
                faculty: 'Mühendislik Fakültesi',
                department: 'Bilgisayar Mühendisliği',
                grade: 3,
                enrollmentYear: 2020,
                status: 'aktif',
                createdBy: admin._id
            },
            {
                studentNumber: '202101002',
                tcKimlik: '10000000466',
                firstName: 'Ayşe',
                lastName: 'Öztürk',
                email: 'ayse.ozturk@ogrenci.edu.tr',
                faculty: 'Fen Edebiyat Fakültesi',
                department: 'Psikoloji',
                grade: 2,
                enrollmentYear: 2021,
                status: 'aktif',
                createdBy: admin._id
            },
            {
                studentNumber: '201901003',
                tcKimlik: '10000000548',
                firstName: 'Ali',
                lastName: 'Yıldız',
                email: 'ali.yildiz@ogrenci.edu.tr',
                faculty: 'İktisadi ve İdari Bilimler Fakültesi',
                department: 'İşletme',
                grade: 4,
                enrollmentYear: 2019,
                status: 'aktif',
                createdBy: admin._id
            }
        ]);
        console.log(`${students.length} öğrenci oluşturuldu`);
        
        const record = await DisciplinaryRecord.create({
            student: students[0]._id,
            incidentDate: new Date('2024-01-15'),
            incidentLocation: 'Merkez Kütüphane',
            incidentDescription: 'Kütüphanede gürültü yaparak diğer öğrencilerin çalışmasını engelleme.',
            violatedArticle: 'Yükseköğretim Kurumları Öğrenci Disiplin Yönetmeliği Madde 5/a',
            penaltyType: 'uyari',
            decisionNumber: 'FK-2024-001',
            decisionDate: new Date('2024-01-20'),
            decisionBody: 'fakulte_yonetim_kurulu',
            status: 'onaylandi',
            statusHistory: [
                {
                    status: 'taslak',
                    changedBy: kurulUyesi._id,
                    reason: 'Kayıt oluşturuldu'
                },
                {
                    status: 'beklemede',
                    changedBy: kurulUyesi._id,
                    reason: 'İncelemeye alındı'
                },
                {
                    status: 'onaylandi',
                    changedBy: admin._id,
                    reason: 'Kurul kararı onaylandı'
                }
            ],
            createdBy: kurulUyesi._id
        });
        console.log('Test disiplin kaydı oluşturuldu:', record.recordNumber);
        
        console.log('\n========================================');
        console.log('SEED İŞLEMİ TAMAMLANDI!');
        console.log('========================================');
        console.log('\nGiriş Bilgileri:');
        console.log('Admin: admin@disiplin.edu.tr / Admin123!@#456');
        console.log('Kurul Üyesi: kurul@disiplin.edu.tr / Kurul123!@#456');
        console.log('Öğrenci İşleri: ogrenciisleri@disiplin.edu.tr / Ogrenci123!@#456');
        console.log('========================================\n');
        
        process.exit(0);
    } catch (error) {
        console.error('Seed hatası:', error);
        process.exit(1);
    }
};

seedData();
