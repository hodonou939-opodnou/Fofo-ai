insert into rhythms (slug, name, alternate_names, description_fr, cultural_review_status, status, sort_order)
values
  (
    'tchinkounme',
    'Tchinkounmè',
    array['Tchinkoumé', 'Tchingounmin', 'Tchinkounmey', 'Gota'],
    'Rythme mahi de Savalou (Collines). Percussion aquatique (tohoun). Origine funéraire, devenu festif. Modernisé en « Tchink System » par Stan Tohon.',
    'unverified',
    'published',
    1
  ),
  (
    'zinli',
    'Zinli',
    array['Avi Zinli', 'Zinli rénové'],
    'Rythme fon d''Abomey (Zou), créé sous le règne du roi Glèlè (XIXe s.). À l''origine funéraire royal. Instrument principal : kpézin (jarre). Modernisé en « Zinli rénové » par Alèkpéhanhou.',
    'unverified',
    'published',
    2
  ),
  (
    'toba',
    'Toba',
    array['Toba-Hanyé'],
    'Rythme populaire, influence yoruba-nago. Présent dans les Collines, le Zou, l''Atlantique, le Littoral. Utilisé pour fêtes, mariages, funérailles, souvent associé au Hanyé.',
    'unverified',
    'published',
    3
  )
on conflict (slug) do nothing;
