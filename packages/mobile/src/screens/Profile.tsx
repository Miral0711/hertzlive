import React, { useEffect } from 'react';
import { ScrollView, Text, View } from 'react-native';
import { Screen, TopBar, BackButton, backName } from '../ui/frame';
import { Avatar } from '../ui/faces';
import { DayRow, Strong, Sub } from '../ui/DayRows';
import { useNavigate, useSearchParams } from '../platform/router';
import { useStyles } from '../platform/theme';
import { me, staff, state, svc, can, useStore } from '../store';
import { logout } from '../../../frontend/src/desktop/session';
import { t, getLang } from '../../../frontend/src/shared/i18n';

const ORIGIN = 'field-profile-from';

function Row({ to, onClick, title, detail, value, first }: { to?: string; onClick?: () => void; title: string; detail?: string; value?: string; first?: boolean }) {
  const s = useStyles((c) => ({ val: { color: c.ink3, fontSize: 14, fontWeight: '600' } }));
  return (
    <DayRow
      first={first} to={to} onPress={onClick} label={title}
      left={<><Strong>{title}</Strong>{detail ? <Sub>{detail}</Sub> : null}</>}
      acts={value ? <Text style={s.val}>{value}</Text> : undefined}
    />
  );
}

export default function Profile() {
  useStore();
  const person = me();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const from = params.get('from');
  const lang = getLang();
  const look = ({ system: 'Phone', light: 'Light', dark: 'Dark' } as any)[state.theme] || 'Phone';
  const stored = (globalThis as any).sessionStorage?.getItem(ORIGIN);
  const back = from && from.startsWith('/mobile/') ? from : (stored && stored.startsWith('/mobile/') ? stored : '/mobile/chats');

  useEffect(() => {
    if (from && from.startsWith('/mobile/')) (globalThis as any).sessionStorage?.setItem(ORIGIN, from);
  }, [from]);

  const bookTo = `${state.role === 'client' ? '/mobile/book?kind=meet' : '/mobile/book?kind=room'}&from=${encodeURIComponent('/mobile/profile')}`;
  const punches = staff() ? svc.punches() : null;

  const s = useStyles((c) => ({
    h1: { flex: 1, fontSize: 17, fontWeight: '600', color: c.ink },
    body: { flex: 1, backgroundColor: c.ground },
    content: { paddingHorizontal: 14, paddingTop: 12, paddingBottom: 40 },
    who: { flexDirection: 'row', alignItems: 'center', gap: 14, padding: 14, borderRadius: 16, borderWidth: 1, borderColor: c.line, backgroundColor: c.surface },
    name: { color: c.ink, fontSize: 18, fontWeight: '600', lineHeight: 22 },
    meta: { marginTop: 1, color: c.ink2, fontSize: 14, lineHeight: 19 },
    sect: { marginTop: 10, marginBottom: 2, marginHorizontal: 2, fontSize: 12, fontWeight: '700', letterSpacing: 0.6, textTransform: 'uppercase', color: c.ink2 },
    card: { marginTop: 8, paddingHorizontal: 14, borderRadius: 16, borderWidth: 1, borderColor: c.line, backgroundColor: c.surface },
  }));

  return (
    <Screen>
      <TopBar style={{ gap: 4, paddingRight: 6 }}>
        <BackButton to={back} label={backName(back)} showLabel={false} />
        <Text style={s.h1}>{t('Profile')}</Text>
      </TopBar>
      <ScrollView style={s.body} contentContainerStyle={s.content} keyboardShouldPersistTaps="handled">
        <View style={s.who}>
          <Avatar person={person} size="lg" />
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text style={s.name}>{person?.name}</Text>
            <Text style={s.meta}>{person?.title}</Text>
          </View>
        </View>
        <Text style={s.sect}>{t('This phone')}</Text>
        <View style={s.card}>
          {punches && <Row first to="/mobile/punches" title={t('This month')} detail={t('{0} late · {1}h', punches.late, punches.hours)} value={t('{0} days', punches.days)} />}
          <Row first={!punches} to="/mobile/appearance" title={t('Appearance')} detail={look === 'Phone' ? t('Follows this phone') : t('Chosen on this phone')} value={t(look)} />
          <Row to="/mobile/language" title={t('Language')} detail={t('Menus only')} value={lang} />
        </View>

        <Text style={s.sect}>{t('Studio')}</Text>
        <View style={s.card}>
          <Row first to="/mobile/people" title={t('People and contractors')} detail={t('Phone numbers, one tap to call')} />
          <Row to="/mobile/holidays" title={staff() ? t('Holidays and my leave') : t('Holidays')} detail={t('Office closed days')} />
          {can('booking', 'w') && <Row to={bookTo} title={state.role === 'client' ? t('Book a meeting') : t('Book a room')} detail={t('Pick a day and time')} />}
          {state.role === 'partner' && <Row to="/mobile/notice" title={t('Notice to everyone')} detail={t('One message, every project chat')} />}
          {staff() && can('review', 'r') && <Row to="/mobile/reviews" title={t('My reviews')} detail={t('Monthly score, strengths and growth')} />}
        </View>

        <View style={s.card}>
          <Row first title={t('Sign out')} detail={t('Return to the phone sign-in')} onClick={() => { logout(); navigate('/mobile/login', { replace: true }); }} />
        </View>
      </ScrollView>
    </Screen>
  );
}
