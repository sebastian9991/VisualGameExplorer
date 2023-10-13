import json

with open('steamdb.json', 'r', encoding='utf-8') as f:
    data = json.load(f)

keep_fields = ['sid', 'store_url', 'published_store', 'image', 'name', 'current_price',
               'platforms', 'categories', 'genres', 'tags', 'gfq_difficulty', 'hltb_complete']

new_data = []
for entry in data:
    # Only keep entries without null values for the necessary fields
    if all(entry.get(field) is not None for field in keep_fields):
        # Exclude entries without English language
        if 'English' in entry.get('languages', '').split(','):
            # Convert comma-separated fields to JSON lists
            for field in ['platforms', 'genres', 'tags', 'categories']:
                if field in entry:
                    entry[field] = entry[field].split(',')
            # Calculate composite score as average of meta_score, grnk_score, and igdb_score
            scores = [entry.get('meta_score'), entry.get('grnk_score'), entry.get('igdb_score')]
            if all(score is not None for score in scores):
                composite_score = sum(scores) / len(scores)
            else:
                non_null_scores = [score for score in scores if score is not None]
                if len(non_null_scores) > 0:
                    composite_score = sum(non_null_scores) / len(non_null_scores)
                else:
                    continue
            entry['composite_score'] = composite_score
            # Rename fields
            new_entry = {
                'id': entry.get('sid'),
                'url': entry.get('store_url'),
                'date': entry.get('published_store'),
                'image': entry.get('image'),
                'name': entry.get('name'),
                'price': entry.get('current_price'),
                'os': entry.get('platforms'),
                'mode': entry.get('categories'),
                'genres': entry.get('genres'),
                'tags': entry.get('tags'),
                'difficulty': entry.get('gfq_difficulty'),
                'duration': entry.get('hltb_complete'),
                'rating': entry.get('composite_score')
            }
            new_data.append(new_entry)

# Write the new data to a new JSON file
with open('project_data.json', 'w') as f:
    json.dump(new_data, f, indent=2)

