function startScraping() {
    const courseCode = document.getElementById('courseCode').value;
    fetch('/scrape', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({ course_code: courseCode }),
    })
    .then(response => response.json())
    .then(data => console.log(data));
    alert('Scraping complete! You can now click on "Get Results".');
}

function getResults() {
    fetch('/results')
    .then(response => response.json())
    .then(data => {
        if (data.length > 0) {
            data.sort((a, b) => {
                if (a.Pinned === b.Pinned) {
                    return new Date(b.Timestamp) - new Date(a.Timestamp);
                }
                return a.Pinned ? -1 : 1;
            });
            const itemsPerPage = 2; // Set the number of items per page
            let currentPage = 1;
            const numberOfPages = Math.ceil(data.length / itemsPerPage);

            const paginateData = (page) => {
                const tableContainer = document.getElementById('tableContainer');
                tableContainer.innerHTML = '';  // Clear existing content
                const startIndex = (page - 1) * itemsPerPage;
                const endIndex = startIndex + itemsPerPage;
                const paginatedItems = data.slice(startIndex, endIndex);

                // Create a Bootstrap list group
                const listGroup = document.createElement('ul');
                listGroup.className = 'list-group';

                paginatedItems.forEach(course => {
                    const listItem = document.createElement('li');
                    listItem.className = 'list-group-item';
                    const detailsDiv = document.createElement('div');

                    Object.keys(course).forEach(key => {
                        if (key !== 'Timestamp') {
                            const detailP = document.createElement('p');
                            detailP.className = 'mb-1'; // Bootstrap class for a small bottom margin
                            const strong = document.createElement('strong');
                            strong.textContent = `${key}: `;
                            detailP.appendChild(strong);

                            if (key === 'URL') {
                                const link = document.createElement('a');
                                link.href = course[key];
                                link.className = 'text-break';
                                link.textContent = course[key];
                                link.target = '_blank';
                                detailP.appendChild(link);
                            } else {
                                const span = document.createElement('span');
                                span.textContent = course[key];
                                detailP.appendChild(span);
                            }
                            detailsDiv.appendChild(detailP);
                        }
                    });

                    // Create delete button for each entry
                    const deleteButton = document.createElement('button');
                    deleteButton.className = 'btn btn-danger btn-sm';
                    deleteButton.style.float = 'right';
                    deleteButton.innerHTML = '<i class="fa fa-trash"></i>'; 
                    deleteButton.onclick = function() {
                        if (confirm('Are you sure you want to delete this entry?')) {
                            // Replace '/delete-entry' with your actual backend endpoint
                            fetch('/delete-entry', {
                                method: 'POST',
                                headers: {
                                    'Content-Type': 'application/json',
                                },
                                body: JSON.stringify({ courseCode: course['Course Code'] }) // Assuming 'Course Code' is unique
                            })
                            .then(response => {
                                if (!response.ok) {
                                    throw new Error('Network response was not ok');
                                }
                                return response.json();
                            })
                            .then(data => {
                                if (data.success) {
                                    alert('Entry deleted successfully.');
                                    // Refresh the list after successful deletion
                                    getResults();
                                } else {
                                    alert('Failed to delete the entry.');
                                }
                            })
                            .catch(error => {
                                alert('An error occurred while deleting the entry: ' + error.message);
                            });
                        }
                    };                    
                    detailsDiv.appendChild(deleteButton);

                    listItem.appendChild(detailsDiv);
                    listGroup.appendChild(listItem);
                });

                tableContainer.appendChild(listGroup);
            };

            const setupPaginationButtons = () => {
                const paginationContainer = document.getElementById('paginationContainer');
                paginationContainer.innerHTML = ''; // Clear existing pagination buttons
            
                for (let i = 1; i <= numberOfPages; i++) {
                    const button = document.createElement('li');
                    button.className = `page-item ${currentPage === i ? 'active' : ''}`;
                    // Add 'me-2' to all page-item elements except the last one for margin-end
                    if (i < numberOfPages) {
                        button.classList.add('me-2');
                    }
                    const link = document.createElement('a');
                    link.className = 'page-link';
                    link.href = '#';
                    link.textContent = i;
                    link.addEventListener('click', (e) => {
                        e.preventDefault(); // Prevent the default anchor behavior
                        currentPage = i;
                        paginateData(currentPage);
                        setupPaginationButtons(); // Re-setup pagination buttons
                    });
                    button.appendChild(link);
                    paginationContainer.appendChild(button);
                }
            };

            // Initial call to show the first page
            paginateData(currentPage);
            if (numberOfPages > 1) {
                setupPaginationButtons();
            }
        } else {
            document.getElementById('tableContainer').textContent = 'No data available';
        }
    })
    .catch(error => {
        console.error('Error fetching results:', error);
        alert('An error occurred while fetching the results.');
    });
}


