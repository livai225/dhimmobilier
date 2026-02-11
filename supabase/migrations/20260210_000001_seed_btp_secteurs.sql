-- Seed BTP sectors in secteurs_activite (idempotent)
INSERT INTO public.secteurs_activite (nom, description)
SELECT v.nom, 'Secteur BTP'
FROM (
  VALUES
    ('Maçonnerie'),
    ('Électricité'),
    ('Plomberie'),
    ('Menuiserie'),
    ('Peinture'),
    ('Carrelage'),
    ('Charpente'),
    ('Couverture'),
    ('Climatisation'),
    ('Serrurerie'),
    ('Topographie'),
    ('Terrassement'),
    ('Génie civil'),
    ('Étanchéité'),
    ('Plâtrerie'),
    ('Vitrerie')
) AS v(nom)
WHERE NOT EXISTS (
  SELECT 1
  FROM public.secteurs_activite s
  WHERE lower(
    translate(s.nom, 'ÀÂÄÃÅÆÇÈÉÊËÌÍÎÏÐÑÒÓÔÖÕØÙÚÛÜÝŸàâäãåæçèéêëìíîïðñòóôöõøùúûüýÿ', 
                   'AAAAAACEEEEIIIIDNOOOOOUUUUYYaaaaaaceeeeiiiidnooooouuuuyy')
  ) = lower(
    translate(v.nom, 'ÀÂÄÃÅÆÇÈÉÊËÌÍÎÏÐÑÒÓÔÖÕØÙÚÛÜÝŸàâäãåæçèéêëìíîïðñòóôöõøùúûüýÿ', 
                   'AAAAAACEEEEIIIIDNOOOOOUUUUYYaaaaaaceeeeiiiidnooooouuuuyy')
  )
);
