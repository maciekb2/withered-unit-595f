ALTER TABLE social_assets DROP CONSTRAINT IF EXISTS social_assets_kind_check;
ALTER TABLE social_assets ADD CONSTRAINT social_assets_kind_check CHECK (
  kind IN (
    'reel','instagram_post',
    'carousel_01','carousel_02','carousel_03','carousel_04','carousel_05',
    'carousel_06','carousel_07','carousel_08','carousel_09','carousel_10'
  )
);
