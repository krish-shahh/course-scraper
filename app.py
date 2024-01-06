from flask import Flask, render_template, jsonify, request
import threading
import csv
import html
import requests
import re
from bs4 import BeautifulSoup
from datetime import datetime

app = Flask(__name__)

def build_url(search_adv_all):
    base_url = "https://www.bu.edu/phpbin/course-search/search.php"
    params = {
        'page': 'w0',
        'pagesize': '-1',
        'adv': '1',
        'nolog': '',
        'search_adv_all': search_adv_all.replace(' ', '+'),
        'yearsem_adv': '2024-SPRG',
        'credits': '*',
        'pathway': '',
        'hub_match': 'all'
    }
    return base_url + '?' + '&'.join([f'{key}={value}' for key, value in params.items()])

def read_existing_course_codes(csv_file):
    existing_courses = set()
    try:
        with open(csv_file, mode='r', newline='', encoding='utf-8') as file:
            csv_reader = csv.DictReader(file)
            for row in csv_reader:
                existing_courses.add(row['Timestamp'])
    except FileNotFoundError:
        # File doesn't exist, will create a new one later
        pass
    return existing_courses

def run_scraper(search_adv_all):
    url = build_url(search_adv_all)
    response = requests.get(url)

    existing_courses = read_existing_course_codes('course_data.csv')

    if response.status_code == 200:
        soup = BeautifulSoup(response.content, 'html.parser')
        courses = soup.find_all('ul', class_='coursearch-results')

        # Open the CSV file in append mode ('a')
        with open('course_data.csv', 'a', newline='', encoding='utf-8') as file:
            writer = csv.DictWriter(file, fieldnames=['Timestamp', 'Course Code', 'Course Name', 'Description', 'Hub Units', 'Credits', 'URL'])
            
            # Write header if the file is new/empty
            if not existing_courses:
                writer.writeheader()

            for course in courses:
                all = soup.find('div', class_='coursearch-result-content')
                course_code = course.find('h6').text
                course_name = course.find('h2').text
                description = course.find('div', class_='coursearch-result-content-description').get_text(" ", strip=True)
                description = re.sub(r'\s+', ' ', description)

                credits_start = description.find('[')
                credits_end = description.find(']', credits_start)
                if credits_start != -1 and credits_end != -1:
                    credits = description[credits_start+1:credits_end].strip()
                    description = description[:credits_start].strip()
                else:
                    credits = "Credits information not found"

                hub_units_list = course.find('ul', class_='coursearch-result-hub-list')
                hub_units = [li.text.strip() for li in hub_units_list.find_all('li')] if hub_units_list else ["N/A"]
                formatted_hub_units = ', '.join(hub_units)

                timestamp = datetime.utcnow().isoformat()  

                if course_code not in existing_courses:
                    writer.writerow({
                        'Timestamp' : timestamp,
                        'Course Code': course_code, 
                        'Course Name': course_name, 
                        'Description': description, 
                        'Hub Units': formatted_hub_units, 
                        'Credits': credits, 
                        'URL': url
                    })
                    existing_courses.add(course_code)  # Add new course code to the set

        print("Data extraction completed successfully.")

    else:
        print("Failed to retrieve the webpage.")

@app.route('/')
def index():
    return render_template('index.html')  # Serve the HTML frontend

@app.route('/scrape', methods=['POST'])
def scrape():
    data = request.json
    course_code = data.get('course_code')
    # Run the scraper in a separate thread
    threading.Thread(target=run_scraper, args=(course_code,)).start()
    return jsonify({"message": "Scraping started"}), 202

@app.route('/results')
def results():
    try:
        data = []
        with open('course_data.csv', newline='', encoding='utf-8') as file:
            reader = csv.DictReader(file)
            for row in reader:
                # Decode HTML entities in the URL
                if 'URL' in row:
                    row['URL'] = html.unescape(row['URL'])
                data.append(row)

        return jsonify(data)
    except Exception as e:
        return jsonify({"error": str(e)})
    
def delete_course_from_csv(course_code, filename='course_data.csv'):
    try:
        # Read all courses except the one to delete into memory
        with open(filename, 'r', newline='', encoding='utf-8') as file:
            reader = csv.DictReader(file)
            courses = [row for row in reader if row['Course Code'] != course_code]

        # Write the updated list back to the file
        with open(filename, 'w', newline='', encoding='utf-8') as file:
            writer = csv.DictWriter(file, fieldnames=reader.fieldnames)
            writer.writeheader()
            writer.writerows(courses)
        return True
    except Exception as e:
        print(f"An error occurred: {e}")
        return False

@app.route('/delete-entry', methods=['POST'])
def delete_entry():
    data = request.get_json()
    course_code = data['courseCode']
    success = delete_course_from_csv(course_code)
    return jsonify(success=success)

if __name__ == '__main__':
    app.run(debug=True)
